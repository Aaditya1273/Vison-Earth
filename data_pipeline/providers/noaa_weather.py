import os
import logging
import datetime
import json
import requests
from typing import Dict, List, Optional, Any, Union
import pandas as pd
import tempfile
from pathlib import Path
import netCDF4 as nc
import xarray as xr
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NOAAWeatherConnector:
    """
    Connector for NOAA weather data services
    Provides methods to fetch weather data, forecasts, and historical climate data
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = 'https://www.ncdc.noaa.gov/cdo-web/api/v2'
    ):
        """
        Initialize the NOAA weather data connector
        
        Args:
            api_key: API key for NOAA Climate Data Online (CDO) API
                     (defaults to env var NOAA_API_KEY)
            base_url: Base URL for the NOAA CDO API
        """
        self.api_key = api_key or os.getenv('NOAA_API_KEY')
        self.base_url = base_url
        
        if not self.api_key:
            logger.warning("NOAA API key not provided. Set NOAA_API_KEY environment variable.")
        else:
            logger.info("Initialized NOAA Weather connector")
    
    def _make_request(
        self, 
        endpoint: str, 
        params: Dict[str, Any] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Make an API request to NOAA
        
        Args:
            endpoint: API endpoint to call
            params: Query parameters
            
        Returns:
            Response data as dictionary
        """
        if not self.api_key:
            logger.error("NOAA API key not provided. Cannot make request.")
            return None
        
        headers = {
            'token': self.api_key
        }
        
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return None
    
    def get_available_datasets(self) -> List[Dict[str, Any]]:
        """
        Get a list of available datasets
        
        Returns:
            List of dataset metadata dictionaries
        """
        response = self._make_request('datasets')
        if response and 'results' in response:
            logger.info(f"Retrieved {len(response['results'])} available datasets")
            return response['results']
        return []
    
    def get_available_data_categories(self) -> List[Dict[str, Any]]:
        """
        Get a list of available data categories
        
        Returns:
            List of data category metadata dictionaries
        """
        response = self._make_request('datacategories')
        if response and 'results' in response:
            logger.info(f"Retrieved {len(response['results'])} available data categories")
            return response['results']
        return []
    
    def get_available_stations(
        self,
        location_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        extent: Optional[List[float]] = None,  # [min_lat, min_lon, max_lat, max_lon]
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get a list of available weather stations
        
        Args:
            location_id: Filter by location ID
            dataset_id: Filter by dataset ID
            extent: Geographic bounding box [min_lat, min_lon, max_lat, max_lon]
            limit: Maximum number of results
            
        Returns:
            List of station metadata dictionaries
        """
        params = {'limit': limit}
        
        if location_id:
            params['locationid'] = location_id
        
        if dataset_id:
            params['datasetid'] = dataset_id
        
        if extent:
            params['extent'] = f"{extent[0]},{extent[1]},{extent[2]},{extent[3]}"
        
        response = self._make_request('stations', params)
        if response and 'results' in response:
            logger.info(f"Retrieved {len(response['results'])} weather stations")
            return response['results']
        return []
    
    def get_data(
        self,
        dataset_id: str,
        start_date: Union[str, datetime.datetime],
        end_date: Union[str, datetime.datetime],
        station_id: Optional[str] = None,
        data_type_id: Optional[str] = None,
        location_id: Optional[str] = None,
        limit: int = 1000
    ) -> pd.DataFrame:
        """
        Get weather data for a specific dataset and parameters
        
        Args:
            dataset_id: Dataset identifier (e.g., 'GHCND' for Global Historical Climatology Network Daily)
            start_date: Start date for data retrieval
            end_date: End date for data retrieval
            station_id: Filter by weather station ID
            data_type_id: Filter by data type ID
            location_id: Filter by location ID
            limit: Maximum number of results
            
        Returns:
            Pandas DataFrame containing the requested data
        """
        # Convert dates to strings if they are datetime objects
        if isinstance(start_date, datetime.datetime):
            start_date = start_date.strftime('%Y-%m-%d')
        if isinstance(end_date, datetime.datetime):
            end_date = end_date.strftime('%Y-%m-%d')
        
        params = {
            'datasetid': dataset_id,
            'startdate': start_date,
            'enddate': end_date,
            'limit': limit
        }
        
        if station_id:
            params['stationid'] = station_id
        
        if data_type_id:
            params['datatypeid'] = data_type_id
        
        if location_id:
            params['locationid'] = location_id
        
        response = self._make_request('data', params)
        
        if response and 'results' in response:
            logger.info(f"Retrieved {len(response['results'])} data points")
            return pd.DataFrame(response['results'])
        
        logger.warning("No data retrieved")
        return pd.DataFrame()
    
    def get_gridded_data(
        self,
        dataset: str = 'gfs-ani-history',  # GFS Analysis Historical
        variables: List[str] = ['TMP_2-HTGL'],  # 2m Temperature
        start_date: Optional[Union[str, datetime.datetime]] = None,
        end_date: Optional[Union[str, datetime.datetime]] = None,
        bbox: Optional[List[float]] = None,  # [west, south, east, north]
        output_dir: Optional[str] = None
    ) -> Optional[Dict[str, str]]:
        """
        Get gridded weather data (e.g., GFS model output)
        This uses a different API than the NOAA CDO API
        
        Args:
            dataset: Dataset identifier
            variables: List of variable identifiers
            start_date: Start date for data retrieval
            end_date: End date for data retrieval
            bbox: Geographic bounding box [west, south, east, north]
            output_dir: Directory to save the downloaded data
            
        Returns:
            Dictionary mapping variable names to file paths
        """
        # This is a simplified implementation and would need to be expanded
        # for a production system to handle the complexities of gridded data access
        
        logger.warning("get_gridded_data is a placeholder implementation")
        logger.info(f"Would download {dataset} data for variables {variables}")
        
        # In a real implementation, this would download NetCDF or GRIB files
        # from NOAA's NOMADS (NOAA Operational Model Archive and Distribution System)
        # or other NOAA data services
        
        return {}
    
    def download_goes_satellite_data(
        self,
        product: str = 'ABI-L2-CMIPF',  # Cloud and Moisture Imagery
        satellite: str = 'G16',  # GOES-16
        year: int = 2023,
        day_of_year: int = 1,
        hour: int = 0,
        output_dir: Optional[str] = None
    ) -> Optional[str]:
        """
        Download GOES satellite data from NOAA AWS bucket
        
        Args:
            product: GOES product identifier
            satellite: Satellite identifier (G16 or G17)
            year: Year
            day_of_year: Day of year (1-366)
            hour: Hour (0-23)
            output_dir: Directory to save the downloaded data
            
        Returns:
            Path to the downloaded file
        """
        # Create output directory if it doesn't exist
        if not output_dir:
            output_dir = tempfile.mkdtemp()
        else:
            os.makedirs(output_dir, exist_ok=True)
        
        # Base URL for GOES data on AWS
        base_url = f"https://noaa-goes{satellite[-2:]}.s3.amazonaws.com"
        
        # Construct the URL for the specified product and time
        url = f"{base_url}/{product}/{year}/{day_of_year:03d}/{hour:02d}/OR_{product}-M6C01_{satellite}_s{year}{day_of_year:03d}{hour:02d}00_e{year}{day_of_year:03d}{hour:02d}59_c{year}{day_of_year:03d}{hour+1:02d}10.nc"
        
        logger.info(f"Downloading GOES data from {url}")
        
        try:
            # Download the file
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            # Save to file
            output_path = os.path.join(output_dir, url.split('/')[-1])
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"Downloaded GOES data to {output_path}")
            return output_path
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error downloading GOES data: {str(e)}")
            return None
    
    def process_netcdf(
        self,
        file_path: str,
        variables: Optional[List[str]] = None
    ) -> xr.Dataset:
        """
        Process a NetCDF file into an xarray Dataset
        
        Args:
            file_path: Path to NetCDF file
            variables: List of variable names to extract (if None, extract all)
            
        Returns:
            xarray Dataset containing the data
        """
        try:
            # Open the NetCDF file as an xarray Dataset
            ds = xr.open_dataset(file_path)
            
            # Filter variables if specified
            if variables:
                ds = ds[variables]
            
            logger.info(f"Processed NetCDF file {file_path} with variables {list(ds.data_vars.keys())}")
            return ds
        
        except Exception as e:
            logger.error(f"Error processing NetCDF file {file_path}: {str(e)}")
            raise


# Example usage
if __name__ == "__main__":
    # Initialize connector
    connector = NOAAWeatherConnector()
    
    # List available datasets
    datasets = connector.get_available_datasets()
    if datasets:
        print("Available datasets:")
        for dataset in datasets[:5]:  # Show first 5 datasets
            print(f"  {dataset['id']}: {dataset['name']}")
    
    # Get weather stations in the San Francisco Bay Area
    stations = connector.get_available_stations(
        dataset_id='GHCND',  # Global Historical Climatology Network Daily
        extent=[37.7, -122.5, 37.9, -122.2],  # [min_lat, min_lon, max_lat, max_lon]
        limit=10
    )
    
    if stations:
        print("\nWeather stations in San Francisco Bay Area:")
        for station in stations:
            print(f"  {station['id']}: {station['name']} ({station['latitude']}, {station['longitude']})")
        
        # Get temperature data for the first station
        first_station = stations[0]['id']
        data = connector.get_data(
            dataset_id='GHCND',
            start_date='2023-01-01',
            end_date='2023-01-31',
            station_id=first_station,
            data_type_id='TMAX',  # Maximum temperature
            limit=100
        )
        
        if not data.empty:
            print(f"\nTemperature data for station {first_station}:")
            print(data.head())
