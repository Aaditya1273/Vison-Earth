from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from geojson_pydantic import Point, Polygon


class WeatherDataBase(BaseModel):
    """Base schema for weather data"""
    source: str = Field(..., description="Source of the weather data (e.g., 'NOAA', 'ECMWF')")
    timestamp: datetime = Field(..., description="Timestamp of the weather data")
    data_type: str = Field(..., description="Type of weather data (e.g., 'temperature', 'precipitation')")
    value: float = Field(..., description="Numerical value of the weather data")
    unit: str = Field(..., description="Unit of measurement (e.g., 'C', 'mm', 'm/s')")
    station_id: Optional[str] = Field(None, description="ID of the weather station, if applicable")
    station_name: Optional[str] = Field(None, description="Name of the weather station, if applicable")
    metadata: Optional[Dict[str, Any]] = Field({}, description="Additional metadata for the weather data")


class WeatherDataCreate(WeatherDataBase):
    """Schema for creating weather data"""
    # GeoJSON Point for location
    latitude: float = Field(..., description="Latitude of the weather data location")
    longitude: float = Field(..., description="Longitude of the weather data location")

    class Config:
        schema_extra = {
            "example": {
                "source": "NOAA",
                "timestamp": "2023-01-01T12:00:00Z",
                "data_type": "temperature",
                "value": 25.5,
                "unit": "C",
                "station_id": "KOAK",
                "station_name": "Oakland International Airport",
                "latitude": 37.7214,
                "longitude": -122.2208,
                "metadata": {
                    "quality_flag": "good",
                    "measurement_method": "automatic"
                }
            }
        }


class WeatherDataResponse(WeatherDataBase):
    """Schema for weather data response"""
    id: int = Field(..., description="Unique identifier for the weather data point")
    location: Dict[str, Any] = Field(..., description="GeoJSON location of the weather data")

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": 1,
                "source": "NOAA",
                "timestamp": "2023-01-01T12:00:00Z",
                "data_type": "temperature",
                "value": 25.5,
                "unit": "C",
                "station_id": "KOAK",
                "station_name": "Oakland International Airport",
                "location": {
                    "type": "Point",
                    "coordinates": [-122.2208, 37.7214]
                },
                "metadata": {
                    "quality_flag": "good",
                    "measurement_method": "automatic"
                }
            }
        }


class WeatherDataQuery(BaseModel):
    """Schema for weather data query parameters"""
    data_type: Optional[str] = None
    source: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    radius: Optional[float] = None  # in meters
    bbox: Optional[List[float]] = None  # [min_lon, min_lat, max_lon, max_lat]
    station_id: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    order_by: str = 'newest'  # 'newest', 'oldest'
    offset: int = 0
    limit: int = 100
    
    @validator('order_by')
    def validate_order_by(cls, v):
        if v not in ['newest', 'oldest']:
            raise ValueError('order_by must be either "newest" or "oldest"')
        return v
    
    @validator('bbox')
    def validate_bbox(cls, v):
        if v is not None:
            if len(v) != 4:
                raise ValueError('bbox must have 4 elements: [min_lon, min_lat, max_lon, max_lat]')
            min_lon, min_lat, max_lon, max_lat = v
            if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180):
                raise ValueError('longitude values must be between -180 and 180')
            if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
                raise ValueError('latitude values must be between -90 and 90')
            if min_lon > max_lon or min_lat > max_lat:
                raise ValueError('min values must be less than or equal to max values')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "data_type": "temperature",
                "source": "NOAA",
                "start_date": "2023-01-01T00:00:00Z",
                "end_date": "2023-01-31T23:59:59Z",
                "lat": 37.7749,
                "lon": -122.4194,
                "radius": 10000,
                "min_value": 10.0,
                "max_value": 35.0,
                "order_by": "newest",
                "offset": 0,
                "limit": 100
            }
        }


class TimeSeriesPoint(BaseModel):
    """Schema for a point in a time series"""
    timestamp: datetime
    avg_value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    count: int


class WeatherStatsResponse(BaseModel):
    """Schema for weather statistics response"""
    data_type: str
    start_date: datetime
    end_date: datetime
    interval: str  # 'hourly', 'daily', 'weekly', 'monthly'
    unit: str
    bbox: List[float]  # [min_lon, min_lat, max_lon, max_lat]
    time_series: List[TimeSeriesPoint]
    overall: Dict[str, Any]  # Overall statistics
    
    class Config:
        schema_extra = {
            "example": {
                "data_type": "temperature",
                "start_date": "2023-01-01T00:00:00Z",
                "end_date": "2023-01-31T23:59:59Z",
                "interval": "daily",
                "unit": "C",
                "bbox": [-122.5, 37.7, -122.2, 37.9],
                "time_series": [
                    {
                        "timestamp": "2023-01-01T00:00:00Z",
                        "avg_value": 18.5,
                        "min_value": 12.3,
                        "max_value": 24.7,
                        "count": 48
                    },
                    {
                        "timestamp": "2023-01-02T00:00:00Z",
                        "avg_value": 19.2,
                        "min_value": 13.1,
                        "max_value": 25.3,
                        "count": 48
                    }
                ],
                "overall": {
                    "avg_value": 18.9,
                    "min_value": 10.5,
                    "max_value": 27.8,
                    "count": 1440
                }
            }
        }


class WeatherForecastRequest(BaseModel):
    """Schema for weather forecast request"""
    lat: float = Field(..., description="Latitude of the location")
    lon: float = Field(..., description="Longitude of the location")
    start_date: Optional[datetime] = Field(None, description="Start date of the forecast period")
    end_date: Optional[datetime] = Field(None, description="End date of the forecast period")
    data_types: List[str] = Field(["temperature", "precipitation", "wind"], description="Types of weather data to include")
    
    @validator('lat')
    def validate_lat(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('latitude must be between -90 and 90')
        return v
    
    @validator('lon')
    def validate_lon(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('longitude must be between -180 and 180')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "lat": 37.7749,
                "lon": -122.4194,
                "start_date": "2023-01-01T00:00:00Z",
                "end_date": "2023-01-07T23:59:59Z",
                "data_types": ["temperature", "precipitation", "wind"]
            }
        }


class WeatherDataPoint(BaseModel):
    """Schema for a weather data point in a forecast"""
    timestamp: datetime
    value: float
    unit: str
    
    class Config:
        schema_extra = {
            "example": {
                "timestamp": "2023-01-01T12:00:00Z",
                "value": 22.5,
                "unit": "C"
            }
        }


class WeatherForecastResponse(BaseModel):
    """Schema for weather forecast response"""
    location: Dict[str, Any]  # GeoJSON Point
    start_date: datetime
    end_date: datetime
    forecast_generated_at: datetime
    forecasts: Dict[str, List[WeatherDataPoint]]  # data_type -> list of data points
    
    class Config:
        schema_extra = {
            "example": {
                "location": {
                    "type": "Point",
                    "coordinates": [-122.4194, 37.7749]
                },
                "start_date": "2023-01-01T00:00:00Z",
                "end_date": "2023-01-07T23:59:59Z",
                "forecast_generated_at": "2022-12-31T18:00:00Z",
                "forecasts": {
                    "temperature": [
                        {
                            "timestamp": "2023-01-01T00:00:00Z",
                            "value": 15.2,
                            "unit": "C"
                        },
                        {
                            "timestamp": "2023-01-01T06:00:00Z",
                            "value": 14.1,
                            "unit": "C"
                        }
                    ],
                    "precipitation": [
                        {
                            "timestamp": "2023-01-01T00:00:00Z",
                            "value": 0.0,
                            "unit": "mm"
                        },
                        {
                            "timestamp": "2023-01-01T06:00:00Z",
                            "value": 2.5,
                            "unit": "mm"
                        }
                    ]
                }
            }
        }
