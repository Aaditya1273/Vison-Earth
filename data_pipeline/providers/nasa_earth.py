import os
import logging
import datetime
import json
import requests
from typing import Dict, List, Optional, Any, Union, Tuple
import pandas as pd
import tempfile
from pathlib import Path
import rasterio
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NASAEarthDataConnector:
    """
    Connector for NASA Earth data services
    Provides methods to access NASA's Earth Observation data, including MODIS, VIIRS, and Landsat
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = 'https://api.nasa.gov/planetary'
    ):
        """
        Initialize the NASA Earth Data connector
        
        Args:
            api_key: API key for NASA Earth Data API (defaults to env var NASA_API_KEY)
            base_url: Base URL for NASA API
        """
        self.api_key = api_key or os.getenv('NASA_API_KEY')
        self.base_url = base_url
        
        if not self.api_key:
            logger.warning("NASA API key not provided. Set NASA_API_KEY environment variable.")
            logger.info("Using demo key which has rate limits.")
            self.api_key = 'DEMO_KEY'
        
        logger.info("Initialized NASA Earth Data connector")
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    def _make_request(
        self, 
        endpoint: str, 
        params: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Make an API request to NASA APIs
        
        Args:
            endpoint: API endpoint to call
            params: Query parameters
            
        Returns:
            Response data as dictionary
        """
        if params is None:
            params = {}
        
        # Add API key to parameters
        params['api_key'] = self.api_key
        
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            if response.status_code == 429:
                logger.warning("Rate limit exceeded. Retrying with exponential backoff.")
                raise  # Retry with tenacity
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return None
    
    def get_earth_imagery(
        self,
        lat: float,
        lon: float,
        date: Optional[Union[str, datetime.datetime]] = None,
        cloud_score: bool = True,
        dim: float = 0.15  # in degrees (~17km at equator)
    ) -> Optional[Dict[str, Any]]:
        """
        Get Earth imagery for a specific location and date
        
        Args:
            lat: Latitude in decimal degrees
            lon: Longitude in decimal degrees
            date: Date for the imagery (if None, use most recent)
            cloud_score: Whether to calculate cloud score
            dim: Width and height of image in degrees
            
        Returns:
            Dictionary with image URL and metadata
        """
        # Convert date to string if it's a datetime object
        if isinstance(date, datetime.datetime):
            date = date.strftime('%Y-%m-%d')
        
        params = {
            'lat': lat,
            'lon': lon,
            'cloud_score': str(cloud_score).lower(),
            'dim': dim
        }
        
        if date:
            params['date'] = date
        
        logger.info(f"Fetching Earth imagery for location ({lat}, {lon})")
        
        response = self._make_request('earth/imagery', params)
        
        if response:
            logger.info(f"Retrieved Earth imagery for ({lat}, {lon}), date: {response.get('date')}")
            
            # Add coordinates to response for reference
            response['coordinates'] = {
                'lat': lat,
                'lon': lon,
                'dim': dim
            }
            
            return response
        
        logger.warning(f"Failed to retrieve Earth imagery for ({lat}, {lon})")
        return None
    
    def get_earth_assets(
        self,
        lat: float,
        lon: float,
        begin_date: Optional[Union[str, datetime.datetime]] = None,
        end_date: Optional[Union[str, datetime.datetime]] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get available Earth image assets for a specific location and date range
        
        Args:
            lat: Latitude in decimal degrees
            lon: Longitude in decimal degrees
            begin_date: Start date for the search range (if None, defaults to 30 days ago)
            end_date: End date for the search range (if None, defaults to today)
            
        Returns:
            List of available image assets with metadata
        """
        # Set default date range if not provided
        if not begin_date:
            begin_date = datetime.datetime.now() - datetime.timedelta(days=30)
        if not end_date:
            end_date = datetime.datetime.now()
        
        # Convert dates to strings if they are datetime objects
        if isinstance(begin_date, datetime.datetime):
            begin_date = begin_date.strftime('%Y-%m-%d')
        if isinstance(end_date, datetime.datetime):
            end_date = end_date.strftime('%Y-%m-%d')
        
        params = {
            'lat': lat,
            'lon': lon,
            'begin': begin_date,
            'end': end_date
        }
        
        logger.info(f"Fetching Earth assets for location ({lat}, {lon}) from {begin_date} to {end_date}")
        
        response = self._make_request('earth/assets', params)
        
        if response and 'results' in response:
            logger.info(f"Retrieved {len(response['results'])} Earth assets for ({lat}, {lon})")
            return response['results']
        
        logger.warning(f"Failed to retrieve Earth assets for ({lat}, {lon})")
        return []
    
    def download_image(
        self,
        image_url: str,
        output_path: Optional[str] = None
    ) -> Optional[str]:
        """
        Download an image from a URL
        
        Args:
            image_url: URL of the image to download
            output_path: Path to save the downloaded image
            
        Returns:
            Path to the downloaded image
        """
        try:
            # Create output directory if it doesn't exist
            if output_path:
                os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            else:
                # Generate a temporary file path
                tmp_dir = tempfile.mkdtemp()
                output_path = os.path.join(tmp_dir, "nasa_image.jpg")
            
            # Download the image
            response = requests.get(image_url, stream=True, timeout=30)
            response.raise_for_status()
            
            # Save to file
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"Downloaded image to {output_path}")
            return output_path
        
        except Exception as e:
            logger.error(f"Error downloading image from {image_url}: {str(e)}")
            return None
    
    def get_landsat_imagery(
        self,
        bbox: Tuple[float, float, float, float],  # (west, south, east, north)
        start_date: Union[str, datetime.datetime],
        end_date: Union[str, datetime.datetime],
        cloud_cover_max: float = 20.0,
        dataset: str = 'landsat-8-l1'  # landsat-8-l1, landsat-8-l2, etc.
    ) -> List[Dict[str, Any]]:
        """
        Get Landsat imagery metadata using NASA's STAC API
        Note: This is a simplified implementation and would use Earth Engine or CMR in production
        
        Args:
            bbox: Bounding box as (west, south, east, north)
            start_date: Start date for the search range
            end_date: End date for the search range
            cloud_cover_max: Maximum cloud cover percentage
            dataset: Landsat dataset ID
            
        Returns:
            List of image metadata
        """
        logger.info(f"This is a placeholder implementation for Landsat imagery retrieval")
        logger.info(f"In a production system, this would connect to NASA CMR or Earth Engine API")
        
        # This is a simplified mock implementation
        # In production, this would use NASA's Common Metadata Repository (CMR) or Earth Engine
        
        # Mock data for demonstration
        mock_results = [
            {
                'id': 'LC08_L1TP_042034_20230501_20230501_02_T1',
                'datetime': '2023-05-01T16:30:00Z',
                'cloud_cover': 15.2,
                'bbox': bbox,
                'assets': {
                    'red': {'href': 'https://example.com/landsat/LC08_L1TP_042034_20230501_20230501_02_T1_B4.TIF'},
                    'green': {'href': 'https://example.com/landsat/LC08_L1TP_042034_20230501_20230501_02_T1_B3.TIF'},
                    'blue': {'href': 'https://example.com/landsat/LC08_L1TP_042034_20230501_20230501_02_T1_B2.TIF'},
                    'nir': {'href': 'https://example.com/landsat/LC08_L1TP_042034_20230501_20230501_02_T1_B5.TIF'}
                }
            },
            {
                'id': 'LC08_L1TP_042034_20230417_20230417_02_T1',
                'datetime': '2023-04-17T16:30:00Z',
                'cloud_cover': 8.7,
                'bbox': bbox,
                'assets': {
                    'red': {'href': 'https://example.com/landsat/LC08_L1TP_042034_20230417_20230417_02_T1_B4.TIF'},
                    'green': {'href': 'https://example.com/landsat/LC08_L1TP_042034_20230417_20230417_02_T1_B3.TIF'},
                    'blue': {'href': 'https://example.com/landsat/LC08_L1TP_042034_20230417_20230417_02_T1_B2.TIF'},
                    'nir': {'href': 'https://example.com/landsat/LC08_L1TP_042034_20230417_20230417_02_T1_B5.TIF'}
                }
            }
        ]
        
        return mock_results
    
    def get_modis_data(
        self,
        product: str = 'MOD13Q1',  # MODIS Vegetation Indices 16-Day L3 Global 250m
        bbox: Optional[Tuple[float, float, float, float]] = None,
        date: Optional[Union[str, datetime.datetime]] = None,
        output_dir: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get MODIS data products
        
        Args:
            product: MODIS product ID
            bbox: Bounding box as (west, south, east, north)
            date: Date for the data
            output_dir: Directory to save the downloaded data
            
        Returns:
            Dictionary with metadata and file paths
        """
        logger.info(f"This is a placeholder implementation for MODIS data retrieval")
        logger.info(f"In a production system, this would connect to NASA LPDAAC or AppEEARS API")
        
        # This is a simplified mock implementation
        # In production, this would use NASA LPDAAC or AppEEARS API
        
        # Mock data for demonstration
        mock_result = {
            'product': product,
            'date': date.strftime('%Y-%m-%d') if isinstance(date, datetime.datetime) else date,
            'bbox': bbox,
            'status': 'available',
            'files': [
                {
                    'name': f"{product}.A2023121.h08v05.061.2023138031801.hdf",
                    'size': 5840384,
                    'url': f"https://example.com/modis/{product}.A2023121.h08v05.061.2023138031801.hdf"
                }
            ],
            'variables': [
                'NDVI',
                'EVI',
                'VI_Quality',
                'red_reflectance',
                'NIR_reflectance',
                'blue_reflectance',
                'MIR_reflectance',
                'view_zenith_angle',
                'sun_zenith_angle',
                'relative_azimuth_angle',
                'composite_day_of_the_year'
            ]
        }
        
        return mock_result
    
    def get_nasa_worldview_layers(self) -> List[Dict[str, Any]]:
        """
        Get list of available NASA Worldview layers
        
        Returns:
            List of layer metadata
        """
        # This would typically fetch from NASA's GIBS API
        # Using a small sample of mock data for demonstration
        
        mock_layers = [
            {
                "id": "MODIS_Terra_CorrectedReflectance_TrueColor",
                "title": "MODIS Terra True Color",
                "subtitle": "Terra / MODIS",
                "description": "Corrected Reflectance True Color from MODIS Terra",
                "type": "imagery",
                "format": "image/jpeg",
                "period": "daily",
                "startDate": "2000-02-24",
            },
            {
                "id": "VIIRS_SNPP_CorrectedReflectance_TrueColor",
                "title": "VIIRS True Color",
                "subtitle": "Suomi NPP / VIIRS",
                "description": "Corrected Reflectance True Color from VIIRS",
                "type": "imagery",
                "format": "image/jpeg",
                "period": "daily",
                "startDate": "2015-11-24",
            },
            {
                "id": "MODIS_Terra_Land_Surface_Temp_Day",
                "title": "Land Surface Temperature (Day)",
                "subtitle": "Terra / MODIS",
                "description": "Land surface temperature during daytime",
                "type": "data",
                "format": "image/png",
                "period": "daily",
                "startDate": "2000-03-05",
                "colormap": "https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Terra_Land_Surface_Temp_Day.xml"
            }
        ]
        
        return mock_layers
    
    def get_neo_imagery(
        self,
        dataset: str = 'MOD_LSTD_CLIM_M',  # Land Surface Temperature Anomaly
        date: Optional[Union[str, datetime.datetime]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get NASA Earth Observations (NEO) imagery
        
        Args:
            dataset: NEO dataset ID
            date: Date for the imagery
            
        Returns:
            Dictionary with image URL and metadata
        """
        # Convert date to string if it's a datetime object
        if isinstance(date, datetime.datetime):
            date = date.strftime('%Y-%m-%d')
        
        # If no date specified, use most recent
        if not date:
            today = datetime.datetime.now()
            # Use first of current month as a default
            date = today.replace(day=1).strftime('%Y-%m-%d')
        
        # Mock response that would be similar to actual NEO API response
        mock_response = {
            'dataset': dataset,
            'date': date,
            'image_url': f"https://neo.gsfc.nasa.gov/servlet/RenderData?dataset={dataset}&date={date}",
            'format': 'image/png',
            'width': 3600,
            'height': 1800,
            'resolution': '0.1 degrees',
            'colormap_url': f"https://neo.gsfc.nasa.gov/servlet/ColorMap?dataset={dataset}"
        }
        
        return mock_response
    
    def get_srtm_elevation(
        self,
        lat: float,
        lon: float
    ) -> Optional[float]:
        """
        Get elevation data from NASA SRTM dataset
        
        Args:
            lat: Latitude in decimal degrees
            lon: Longitude in decimal degrees
            
        Returns:
            Elevation in meters above sea level
        """
        endpoint = 'earth/elevation'
        params = {
            'lat': lat,
            'lon': lon
        }
        
        response = self._make_request(endpoint, params)
        
        if response and 'elevation' in response:
            logger.info(f"Retrieved elevation for ({lat}, {lon}): {response['elevation']} meters")
            return response['elevation']
        
        logger.warning(f"Failed to retrieve elevation for ({lat}, {lon})")
        return None


# Example usage
if __name__ == "__main__":
    # Initialize connector
    connector = NASAEarthDataConnector()
    
    # Test Earth imagery retrieval
    sf_image = connector.get_earth_imagery(
        lat=37.7749,
        lon=-122.4194,  # San Francisco
        cloud_score=True
    )
    
    if sf_image:
        print(f"Retrieved Earth image for San Francisco:")
        print(f"  Date: {sf_image['date']}")
        print(f"  URL: {sf_image['url']}")
        print(f"  Cloud Score: {sf_image.get('cloud_score')}")
        
        # Download the image
        image_path = connector.download_image(sf_image['url'])
        if image_path:
            print(f"  Downloaded to: {image_path}")
    
    # Test SRTM elevation data
    elevation = connector.get_srtm_elevation(
        lat=27.9881,
        lon=86.9250  # Mount Everest
    )
    
    if elevation:
        print(f"\nElevation at Mount Everest: {elevation} meters")
    
    # Test Landsat imagery metadata
    landsat_images = connector.get_landsat_imagery(
        bbox=(-122.5, 37.7, -122.2, 37.9),  # San Francisco Bay Area
        start_date='2023-01-01',
        end_date='2023-05-01'
    )
    
    if landsat_images:
        print(f"\nFound {len(landsat_images)} Landsat images")
        for image in landsat_images:
            print(f"  ID: {image['id']}")
            print(f"  Date: {image['datetime']}")
            print(f"  Cloud Cover: {image['cloud_cover']}%")
