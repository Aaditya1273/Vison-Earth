import os
import logging
import datetime
from typing import Dict, List, Optional, Any, Union
import json
import pandas as pd
import geopandas as gpd
from pathlib import Path
import tempfile
import sqlalchemy
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
import time

# Import providers
from providers.sentinel_hub import SentinelHubConnector
from providers.noaa_weather import NOAAWeatherConnector

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DataPipelineOrchestrator:
    """
    Orchestrates the data ingestion pipeline from various data sources
    Coordinates data retrieval, processing, and storage
    """
    
    def __init__(
        self,
        db_connection_string: Optional[str] = None,
        data_dir: Optional[str] = None
    ):
        """
        Initialize the data pipeline orchestrator
        
        Args:
            db_connection_string: Database connection string
            data_dir: Directory for temporary data storage
        """
        # Load environment variables
        load_dotenv()
        
        # Set up database connection
        self.db_connection_string = db_connection_string or os.getenv('DATABASE_URL')
        self.engine = None
        if self.db_connection_string:
            try:
                self.engine = sqlalchemy.create_engine(self.db_connection_string)
                logger.info(f"Connected to database")
            except Exception as e:
                logger.error(f"Error connecting to database: {str(e)}")
        
        # Set up data directory
        self.data_dir = data_dir
        if not self.data_dir:
            self.data_dir = os.path.join(os.getcwd(), 'data')
        os.makedirs(self.data_dir, exist_ok=True)
        
        # Initialize data providers
        self.sentinel_hub = SentinelHubConnector()
        self.noaa_weather = NOAAWeatherConnector()
        
        logger.info(f"Initialized data pipeline orchestrator with data directory: {self.data_dir}")
    
    def fetch_satellite_data(
        self,
        bbox: List[float],  # [min_lon, min_lat, max_lon, max_lat]
        start_date: Union[str, datetime.datetime],
        end_date: Union[str, datetime.datetime],
        cloud_cover_max: float = 30.0,
        max_results: int = 5,
        download: bool = False
    ) -> Dict[str, Any]:
        """
        Fetch satellite data from Sentinel Hub
        
        Args:
            bbox: Bounding box [min_lon, min_lat, max_lon, max_lat]
            start_date: Start date for the search range
            end_date: End date for the search range
            cloud_cover_max: Maximum cloud cover percentage
            max_results: Maximum number of results to return
            download: Whether to download the actual data
            
        Returns:
            Dictionary with search results and download info
        """
        logger.info(f"Fetching satellite data for bbox {bbox} from {start_date} to {end_date}")
        
        # Search for products
        products = self.sentinel_hub.search_products(
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            cloud_cover=(0, cloud_cover_max),
            max_results=max_results
        )
        
        result = {
            'products': products,
            'count': len(products),
            'downloads': {}
        }
        
        # Download products if requested
        if download and products:
            download_dir = os.path.join(self.data_dir, 'satellite')
            os.makedirs(download_dir, exist_ok=True)
            
            # Download each product
            for product_id in products:
                try:
                    # Download quicklook preview
                    quicklook_path = self.sentinel_hub.get_quicklook(
                        product_id,
                        output_path=os.path.join(download_dir, f"{product_id}_quicklook.jpg")
                    )
                    
                    result['downloads'][product_id] = {
                        'quicklook': quicklook_path
                    }
                    
                    # Download actual product if requested
                    if download:
                        product_path = self.sentinel_hub.download_product(
                            product_id,
                            output_dir=os.path.join(download_dir, product_id)
                        )
                        
                        if product_path:
                            result['downloads'][product_id]['product'] = product_path
                
                except Exception as e:
                    logger.error(f"Error downloading product {product_id}: {str(e)}")
                    result['downloads'][product_id] = {'error': str(e)}
        
        return result
    
    def fetch_weather_data(
        self,
        bbox: List[float],  # [min_lat, min_lon, max_lat, max_lon]
        start_date: Union[str, datetime.datetime],
        end_date: Union[str, datetime.datetime],
        dataset_id: str = 'GHCND',  # Global Historical Climatology Network Daily
        data_types: List[str] = ['TMAX', 'TMIN', 'PRCP']  # Temperature max, min, precipitation
    ) -> pd.DataFrame:
        """
        Fetch weather data from NOAA
        
        Args:
            bbox: Bounding box [min_lat, min_lon, max_lat, max_lon]
            start_date: Start date for the data retrieval
            end_date: End date for the data retrieval
            dataset_id: Dataset identifier
            data_types: List of data type identifiers
            
        Returns:
            DataFrame containing the weather data
        """
        logger.info(f"Fetching weather data for bbox {bbox} from {start_date} to {end_date}")
        
        # Get weather stations in the area
        stations = self.noaa_weather.get_available_stations(
            dataset_id=dataset_id,
            extent=bbox,
            limit=50
        )
        
        if not stations:
            logger.warning(f"No weather stations found in the specified bbox")
            return pd.DataFrame()
        
        # Collect data from each station
        all_data = []
        
        for station in stations:
            station_id = station['id']
            
            for data_type in data_types:
                try:
                    data = self.noaa_weather.get_data(
                        dataset_id=dataset_id,
                        start_date=start_date,
                        end_date=end_date,
                        station_id=station_id,
                        data_type_id=data_type,
                        limit=1000
                    )
                    
                    if not data.empty:
                        # Add station metadata
                        data['station_name'] = station['name']
                        data['latitude'] = station['latitude']
                        data['longitude'] = station['longitude']
                        data['elevation'] = station.get('elevation', None)
                        
                        all_data.append(data)
                
                except Exception as e:
                    logger.error(f"Error fetching data for station {station_id}, data type {data_type}: {str(e)}")
        
        # Combine all data
        if all_data:
            combined_data = pd.concat(all_data, ignore_index=True)
            logger.info(f"Retrieved {len(combined_data)} weather data points from {len(stations)} stations")
            return combined_data
        else:
            logger.warning(f"No weather data retrieved")
            return pd.DataFrame()
    
    def store_satellite_metadata(self, products: Dict[str, Any]) -> int:
        """
        Store satellite image metadata in the database
        
        Args:
            products: Dictionary of products from Sentinel Hub
            
        Returns:
            Number of records inserted
        """
        if not self.engine:
            logger.error("Database connection not available")
            return 0
        
        try:
            # Convert product metadata to DataFrame
            records = []
            
            for product_id, product in products.items():
                # Extract footprint geometry
                footprint = None
                if 'footprint' in product and product['footprint']:
                    try:
                        # Parse WKT format to geometry
                        footprint = product['footprint']
                    except Exception as e:
                        logger.error(f"Error parsing footprint: {str(e)}")
                
                record = {
                    'id': product_id,
                    'source': 'sentinel-2',
                    'acquisition_date': product.get('beginposition'),
                    'cloud_cover_percentage': product.get('cloudcoverpercentage'),
                    'path': product.get('filename', ''),
                    'footprint': footprint,
                    'metadata': json.dumps(product)
                }
                
                records.append(record)
            
            if not records:
                logger.warning("No records to insert")
                return 0
            
            # Insert into database
            df = pd.DataFrame(records)
            
            with self.engine.connect() as conn:
                # This is a simplified approach, in a production system you would use ORM models
                df.to_sql('satellite_images', conn, if_exists='append', index=False)
            
            logger.info(f"Inserted {len(records)} satellite image metadata records")
            return len(records)
        
        except Exception as e:
            logger.error(f"Error storing satellite metadata: {str(e)}")
            return 0
    
    def store_weather_data(self, weather_data: pd.DataFrame) -> int:
        """
        Store weather data in the database
        
        Args:
            weather_data: DataFrame of weather data
            
        Returns:
            Number of records inserted
        """
        if not self.engine or weather_data.empty:
            logger.error("Database connection not available or no weather data")
            return 0
        
        try:
            # Prepare records for insertion
            records = []
            
            for _, row in weather_data.iterrows():
                record = {
                    'source': 'noaa',
                    'timestamp': row.get('date'),
                    'data_type': row.get('datatype'),
                    'value': row.get('value'),
                    'unit': row.get('units', ''),
                    'station_id': row.get('station'),
                    'station_name': row.get('station_name', ''),
                    'latitude': row.get('latitude'),
                    'longitude': row.get('longitude'),
                    'metadata': json.dumps({
                        'elevation': row.get('elevation'),
                        'attributes': row.get('attributes', {})
                    })
                }
                
                records.append(record)
            
            if not records:
                logger.warning("No weather records to insert")
                return 0
            
            # Insert into database
            df = pd.DataFrame(records)
            
            with self.engine.connect() as conn:
                # This is a simplified approach, in a production system you would use ORM models
                df.to_sql('weather_data', conn, if_exists='append', index=False)
            
            logger.info(f"Inserted {len(records)} weather data records")
            return len(records)
        
        except Exception as e:
            logger.error(f"Error storing weather data: {str(e)}")
            return 0
    
    def run_data_ingestion_pipeline(
        self,
        regions: List[Dict[str, Any]],
        start_date: Union[str, datetime.datetime],
        end_date: Union[str, datetime.datetime],
        include_satellite: bool = True,
        include_weather: bool = True,
        store_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Run the complete data ingestion pipeline
        
        Args:
            regions: List of regions to fetch data for, each with 'name' and 'bbox'
            start_date: Start date for data retrieval
            end_date: End date for data retrieval
            include_satellite: Whether to fetch satellite data
            include_weather: Whether to fetch weather data
            store_in_db: Whether to store the results in the database
            
        Returns:
            Dictionary with results for each region
        """
        logger.info(f"Running data ingestion pipeline for {len(regions)} regions")
        
        results = {}
        
        for region in regions:
            region_name = region.get('name', 'unknown')
            bbox = region.get('bbox')
            
            if not bbox:
                logger.error(f"Region {region_name} has no bbox defined")
                continue
            
            logger.info(f"Processing region: {region_name}")
            results[region_name] = {}
            
            # Fetch satellite data
            if include_satellite:
                satellite_data = self.fetch_satellite_data(
                    bbox=bbox,
                    start_date=start_date,
                    end_date=end_date,
                    cloud_cover_max=30.0,
                    max_results=5,
                    download=False
                )
                
                results[region_name]['satellite'] = {
                    'count': satellite_data['count'],
                    'product_ids': list(satellite_data['products'].keys())
                }
                
                # Store in database
                if store_in_db and satellite_data['count'] > 0:
                    inserted = self.store_satellite_metadata(satellite_data['products'])
                    results[region_name]['satellite']['inserted'] = inserted
            
            # Fetch weather data
            if include_weather:
                # Convert from [min_lon, min_lat, max_lon, max_lat] to [min_lat, min_lon, max_lat, max_lon]
                weather_bbox = [bbox[1], bbox[0], bbox[3], bbox[2]]
                
                weather_data = self.fetch_weather_data(
                    bbox=weather_bbox,
                    start_date=start_date,
                    end_date=end_date
                )
                
                results[region_name]['weather'] = {
                    'count': len(weather_data)
                }
                
                # Store in database
                if store_in_db and not weather_data.empty:
                    inserted = self.store_weather_data(weather_data)
                    results[region_name]['weather']['inserted'] = inserted
        
        logger.info(f"Completed data ingestion pipeline for {len(regions)} regions")
        return results


# Example usage
if __name__ == "__main__":
    # Initialize orchestrator
    orchestrator = DataPipelineOrchestrator()
    
    # Define regions of interest
    regions = [
        {
            'name': 'San Francisco Bay Area',
            'bbox': [-122.5, 37.7, -122.2, 37.9]  # [min_lon, min_lat, max_lon, max_lat]
        },
        {
            'name': 'Amazon Rainforest (Sample)',
            'bbox': [-60.0, -3.0, -59.7, -2.7]
        }
    ]
    
    # Run the pipeline for the last 30 days
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=30)
    
    results = orchestrator.run_data_ingestion_pipeline(
        regions=regions,
        start_date=start_date,
        end_date=end_date,
        include_satellite=True,
        include_weather=True,
        store_in_db=False  # Set to True when database is configured
    )
    
    # Print results summary
    print("\nData Ingestion Pipeline Results:")
    for region_name, region_results in results.items():
        print(f"\nRegion: {region_name}")
        
        if 'satellite' in region_results:
            sat_results = region_results['satellite']
            print(f"  Satellite data: {sat_results['count']} products found")
            if sat_results['count'] > 0:
                print(f"    Product IDs: {', '.join(sat_results['product_ids'][:3])}...")
        
        if 'weather' in region_results:
            weather_results = region_results['weather']
            print(f"  Weather data: {weather_results['count']} data points found")
