from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from app.db.session import get_db
from app.services.weather_service import (
    get_weather_data, 
    get_weather_data_by_id, 
    get_weather_statistics,
    get_weather_heatmap_data
)
from app.schemas.weather import (
    WeatherDataResponse, 
    WeatherDataQuery,
    WeatherStatsResponse
)

router = APIRouter(prefix="/weather", tags=["weather"])
logger = logging.getLogger(__name__)

@router.get("/data", response_model=List[WeatherDataResponse])
async def list_weather_data(
    data_type: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius: Optional[float] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    station_id: Optional[str] = None,
    bbox_min_lon: Optional[float] = Query(None, description="Minimum longitude of bounding box"),
    bbox_min_lat: Optional[float] = Query(None, description="Minimum latitude of bounding box"),
    bbox_max_lon: Optional[float] = Query(None, description="Maximum longitude of bounding box"),
    bbox_max_lat: Optional[float] = Query(None, description="Maximum latitude of bounding box"),
    order_by: Optional[str] = Query("newest", description="Order results by date: 'newest' or 'oldest'"),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve weather data based on filtering criteria
    """
    try:
        # Create query object
        bbox = None
        if all(x is not None for x in [bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat]):
            bbox = [bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat]
        
        query = WeatherDataQuery(
            data_type=data_type,
            source=source,
            start_date=start_date,
            end_date=end_date,
            lat=lat,
            lon=lon,
            radius=radius,
            min_value=min_value,
            max_value=max_value,
            station_id=station_id,
            bbox=bbox,
            order_by=order_by,
            offset=offset,
            limit=limit
        )
        
        logger.info(f"Weather data query: {query}")
        
        # Call service to get data
        weather_data = await get_weather_data(db, query)
        return weather_data
    
    except Exception as e:
        logger.error(f"Error retrieving weather data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while retrieving weather data: {str(e)}"
        )

@router.get("/data/{weather_id}", response_model=WeatherDataResponse)
async def get_weather_data_point(
    weather_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific weather data point by ID
    """
    try:
        # Call service to get data point
        weather_point = await get_weather_data_by_id(db, weather_id)
        
        if not weather_point:
            raise HTTPException(
                status_code=404,
                detail=f"Weather data point with ID {weather_id} not found"
            )
        
        return weather_point
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving weather data point {weather_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while retrieving weather data point: {str(e)}"
        )

@router.get("/statistics", response_model=WeatherStatsResponse)
async def get_weather_stats(
    data_type: str = Query(..., description="Type of weather data (e.g., 'temperature', 'precipitation')"),
    bbox_min_lon: float = Query(..., description="Minimum longitude of bounding box"),
    bbox_min_lat: float = Query(..., description="Minimum latitude of bounding box"),
    bbox_max_lon: float = Query(..., description="Maximum longitude of bounding box"),
    bbox_max_lat: float = Query(..., description="Maximum latitude of bounding box"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    interval: str = Query("daily", description="Time interval for aggregation (hourly, daily, weekly, monthly)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistical aggregations of weather data
    """
    try:
        # Create bounding box
        bbox = [bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat]
        
        # Call service to get statistics
        stats = await get_weather_statistics(
            db,
            data_type=data_type,
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            interval=interval
        )
        
        return stats
    
    except Exception as e:
        logger.error(f"Error generating weather statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while generating weather statistics: {str(e)}"
        )

@router.get("/heatmap", response_model=Dict[str, Any])
async def get_weather_heatmap(
    data_type: str = Query(..., description="Type of weather data (e.g., 'temperature', 'precipitation')"),
    timestamp: datetime = Query(..., description="Timestamp for the data"),
    bbox_min_lon: float = Query(..., description="Minimum longitude of bounding box"),
    bbox_min_lat: float = Query(..., description="Minimum latitude of bounding box"),
    bbox_max_lon: float = Query(..., description="Maximum longitude of bounding box"),
    bbox_max_lat: float = Query(..., description="Maximum latitude of bounding box"),
    resolution: float = Query(0.1, description="Grid resolution in degrees"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get weather data for generating a heatmap visualization
    """
    try:
        # Create bounding box
        bbox = [bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat]
        
        # Call service to get heatmap data
        heatmap_data = await get_weather_heatmap_data(
            db,
            data_type=data_type,
            bbox=bbox,
            timestamp=timestamp,
            resolution=resolution
        )
        
        return heatmap_data
    
    except Exception as e:
        logger.error(f"Error generating weather heatmap data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while generating weather heatmap data: {str(e)}"
        )

@router.get("/data-types", response_model=List[str])
async def get_weather_data_types(
    db: AsyncSession = Depends(get_db)
):
    """
    Get a list of available weather data types
    """
    try:
        # This could be expanded to query the database for actual available types
        # For now, return a predefined list of common weather data types
        data_types = [
            "temperature",
            "precipitation",
            "humidity",
            "wind_speed",
            "wind_direction",
            "pressure",
            "cloud_cover",
            "visibility",
            "uv_index",
            "air_quality"
        ]
        
        return data_types
    
    except Exception as e:
        logger.error(f"Error retrieving weather data types: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while retrieving weather data types: {str(e)}"
        )
