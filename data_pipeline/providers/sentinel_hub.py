import os
import logging
import datetime
from typing import Dict, List, Optional, Tuple, Any, Union
import requests
from sentinelsat import SentinelAPI, geojson_to_wkt, read_geojson
from pathlib import Path
import tempfile
import shutil
import geopandas as gpd
from shapely.geometry import box, shape
import rasterio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SentinelHubConnector:
    """
    Connector for Sentinel Hub / Copernicus Open Access Hub
    Provides methods to search and download Sentinel-2 satellite imagery
    """
    
    def __init__(
        self,
        user: Optional[str] = None,
        password: Optional[str] = None,
        api_url: str = 'https://scihub.copernicus.eu/dhus'
    ):
        """
        Initialize the Sentinel Hub connector
        
        Args:
            user: Username for Sentinel Hub (defaults to env var SENTINEL_HUB_USER)
            password: Password for Sentinel Hub (defaults to env var SENTINEL_HUB_PASSWORD)
            api_url: URL for the Sentinel API
        """
        self.user = user or os.getenv('SENTINEL_HUB_USER')
        self.password = password or os.getenv('SENTINEL_HUB_PASSWORD')
        self.api_url = api_url
        
        if not self.user or not self.password:
            logger.warning("Sentinel Hub credentials not provided. Set SENTINEL_HUB_USER and SENTINEL_HUB_PASSWORD environment variables.")
        else:
            try:
                self.api = SentinelAPI(self.user, self.password, self.api_url)
                logger.info(f"Initialized Sentinel Hub connector for {self.api_url}")
            except Exception as e:
                logger.error(f"Failed to initialize Sentinel Hub connector: {str(e)}")
                self.api = None
    
    def search_products(
        self,
        bbox: Optional[List[float]] = None,  # [min_lon, min_lat, max_lon, max_lat]
        geojson_path: Optional[str] = None,
        start_date: Optional[Union[str, datetime.datetime]] = None,
        end_date: Optional[Union[str, datetime.datetime]] = None,
        cloud_cover: Optional[Tuple[float, float]] = (0, 30),  # (min, max)
        product_type: str = 'S2MSI2A',  # Sentinel-2 Level 2A (atmospheric correction)
        max_results: int = 10
    ) -> Dict[str, Any]:
        """
        Search for Sentinel products based on criteria
        
        Args:
            bbox: Bounding box as [min_lon, min_lat, max_lon, max_lat]
            geojson_path: Path to GeoJSON file defining the area of interest
            start_date: Start date for the search range
            end_date: End date for the search range
            cloud_cover: Tuple of (min, max) cloud cover percentage
            product_type: Sentinel product type
            max_results: Maximum number of results to return
            
        Returns:
            Dictionary of products with metadata
        """
        if self.api is None:
            logger.error("Sentinel Hub API not initialized. Check credentials.")
            return {}
        
        try:
            # Convert dates to datetime objects if they are strings
            if isinstance(start_date, str):
                start_date = datetime.datetime.strptime(start_date, '%Y-%m-%d')
            if isinstance(end_date, str):
                end_date = datetime.datetime.strptime(end_date, '%Y-%m-%d')
            
            # Set default date range if not provided
            if not start_date:
                start_date = datetime.datetime.now() - datetime.timedelta(days=30)
            if not end_date:
                end_date = datetime.datetime.now()
            
            # Define area of interest
            if geojson_path and os.path.exists(geojson_path):
                footprint = geojson_to_wkt(read_geojson(geojson_path))
            elif bbox:
                footprint = geojson_to_wkt(gpd.GeoDataFrame([1], geometry=[box(*bbox)], crs='EPSG:4326').__geo_interface__)
            else:
                logger.error("Either bbox or geojson_path must be provided")
                return {}
            
            # Define query parameters
            query_kwargs = {
                'area': footprint,
                'date': (start_date, end_date),
                'platformname': 'Sentinel-2',
                'producttype': product_type,
                'cloudcoverpercentage': cloud_cover
            }
            
            # Execute the query
            products = self.api.query(**query_kwargs)
            
            # Get product details
            products_df = self.api.to_dataframe(products)
            
            if products_df.empty:
                logger.info("No products found matching the criteria")
                return {}
            
            # Sort by cloud cover and limit results
            products_df = products_df.sort_values('cloudcoverpercentage').head(max_results)
            
            logger.info(f"Found {len(products_df)} Sentinel products matching the criteria")
            
            # Convert to dictionary
            return products_df.to_dict('index')
        
        except Exception as e:
            logger.error(f"Error searching Sentinel products: {str(e)}")
            return {}
    
    def download_product(
        self,
        product_id: str,
        output_dir: Optional[str] = None,
        bands: Optional[List[str]] = None
    ) -> Optional[str]:
        """
        Download a Sentinel product
        
        Args:
            product_id: ID of the product to download
            output_dir: Directory to save the downloaded product
            bands: List of specific bands to download (if None, download all)
            
        Returns:
            Path to the downloaded product
        """
        if self.api is None:
            logger.error("Sentinel Hub API not initialized. Check credentials.")
            return None
        
        try:
            # Create temporary directory if output_dir not provided
            if not output_dir:
                output_dir = tempfile.mkdtemp()
            else:
                os.makedirs(output_dir, exist_ok=True)
            
            logger.info(f"Downloading product {product_id} to {output_dir}")
            
            # Download the product
            download_path = self.api.download(product_id, directory_path=output_dir)
            
            logger.info(f"Downloaded product {product_id} to {download_path}")
            
            # If specific bands are requested, extract them
            if bands and download_path.endswith('.zip'):
                # Implementation for band extraction would go here
                # This requires additional processing of the ZIP file
                pass
            
            return str(download_path)
        
        except Exception as e:
            logger.error(f"Error downloading product {product_id}: {str(e)}")
            return None
    
    def get_quicklook(
        self,
        product_id: str,
        output_path: Optional[str] = None
    ) -> Optional[str]:
        """
        Download a quicklook preview image for a product
        
        Args:
            product_id: ID of the product
            output_path: Path to save the quicklook image
            
        Returns:
            Path to the downloaded quicklook image
        """
        if self.api is None:
            logger.error("Sentinel Hub API not initialized. Check credentials.")
            return None
        
        try:
            # Create output directory if it doesn't exist
            if output_path:
                os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            else:
                # Generate a temporary file path
                tmp_dir = tempfile.mkdtemp()
                output_path = os.path.join(tmp_dir, f"{product_id}_quicklook.jpg")
            
            # Download the quicklook
            self.api.download_quicklook(product_id, output_path)
            
            logger.info(f"Downloaded quicklook for product {product_id} to {output_path}")
            
            return output_path
        
        except Exception as e:
            logger.error(f"Error downloading quicklook for product {product_id}: {str(e)}")
            return None


# Example usage
if __name__ == "__main__":
    # Initialize connector
    connector = SentinelHubConnector()
    
    # Define area of interest (San Francisco Bay Area)
    bbox = [-122.5, 37.7, -122.2, 37.9]  # [min_lon, min_lat, max_lon, max_lat]
    
    # Search for products
    products = connector.search_products(
        bbox=bbox,
        start_date='2023-01-01',
        end_date='2023-01-31',
        cloud_cover=(0, 20),
        max_results=5
    )
    
    # Print product information
    for product_id, product_info in products.items():
        print(f"Product ID: {product_id}")
        print(f"  Title: {product_info['title']}")
        print(f"  Date: {product_info['beginposition']}")
        print(f"  Cloud Cover: {product_info['cloudcoverpercentage']}%")
        print("")
        
        # Download quicklook (preview image)
        quicklook_path = connector.get_quicklook(product_id)
        if quicklook_path:
            print(f"  Quicklook saved to: {quicklook_path}")
            
    # Download the first product if any found
    if products:
        first_product_id = list(products.keys())[0]
        download_path = connector.download_product(first_product_id)
        if download_path:
            print(f"Downloaded product to: {download_path}")
