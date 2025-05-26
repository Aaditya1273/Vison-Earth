import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_, desc
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point, box, mapping
import json

from app.models.spatial_data import WeatherData
from app.schemas.weather import WeatherDataResponse, WeatherDataQuery, WeatherStatsResponse

logger = logging.getLogger(__name__)

async def get_weather_data(
    db: AsyncSession, 
    query: WeatherDataQuery
) -> List[WeatherDataResponse]:
    """
    Retrieve weather data based on filtering criteria
    
    Args:
        db: Database session
        query: Query parameters for filtering
        
    Returns:
        List of weather data points matching the criteria
    """
    try:
        # Build query
        stmt = select(WeatherData)
        
        # Apply filters
        if query.data_type:
            stmt = stmt.where(WeatherData.data_type == query.data_type)
        
        if query.source:
            stmt = stmt.where(WeatherData.source == query.source)
        
        if query.start_date:
            stmt = stmt.where(WeatherData.timestamp >= query.start_date)
        
        if query.end_date:
            stmt = stmt.where(WeatherData.timestamp <= query.end_date)
        
        # Apply spatial filter if coordinates or bbox is provided
        if query.lat is not None and query.lon is not None and query.radius is not None:
            # Create a point and find data within radius (in meters)
            point = Point(query.lon, query.lat)
            point_wkb = from_shape(point, srid=4326)
            stmt = stmt.where(
                func.ST_DWithin(
                    func.ST_Transform(WeatherData.location, 3857),
                    func.ST_Transform(point_wkb, 3857),
                    query.radius
                )
            )
        elif query.bbox:
            # Filter by bounding box
            min_lon, min_lat, max_lon, max_lat = query.bbox
            bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
            bbox_wkb = from_shape(bbox_geom, srid=4326)
            stmt = stmt.where(func.ST_Within(WeatherData.location, bbox_wkb))
        
        # Apply station filter if provided
        if query.station_id:
            stmt = stmt.where(WeatherData.station_id == query.station_id)
        
        # Apply min/max value filter if provided
        if query.min_value is not None:
            stmt = stmt.where(WeatherData.value >= query.min_value)
        
        if query.max_value is not None:
            stmt = stmt.where(WeatherData.value <= query.max_value)
        
        # Apply pagination
        stmt = stmt.offset(query.offset).limit(query.limit)
        
        # Order by timestamp (newest first by default)
        if query.order_by == 'oldest':
            stmt = stmt.order_by(WeatherData.timestamp.asc())
        else:
            stmt = stmt.order_by(WeatherData.timestamp.desc())
        
        # Execute query
        result = await db.execute(stmt)
        weather_data_points = result.scalars().all()
        
        # Convert to response models
        responses = []
        for data_point in weather_data_points:
            # Convert WKB geometry to GeoJSON
            location_shape = to_shape(data_point.location)
            location_geojson = mapping(location_shape)
            
            # Convert to response model
            response = WeatherDataResponse(
                id=data_point.id,
                source=data_point.source,
                timestamp=data_point.timestamp,
                data_type=data_point.data_type,
                value=data_point.value,
                unit=data_point.unit,
                station_id=data_point.station_id,
                station_name=data_point.station_name,
                location=location_geojson,
                metadata=json.loads(data_point.metadata) if isinstance(data_point.metadata, str) else data_point.metadata
            )
            responses.append(response)
        
        logger.info(f"Retrieved {len(responses)} weather data points")
        return responses
    
    except Exception as e:
        logger.error(f"Error retrieving weather data: {e}", exc_info=True)
        raise

async def get_weather_data_by_id(
    db: AsyncSession, 
    data_id: int
) -> Optional[WeatherDataResponse]:
    """
    Get a specific weather data point by ID
    
    Args:
        db: Database session
        data_id: ID of the weather data point
        
    Returns:
        Weather data point if found, None otherwise
    """
    try:
        # Build query
        stmt = select(WeatherData).where(WeatherData.id == data_id)
        
        # Execute query
        result = await db.execute(stmt)
        data_point = result.scalars().first()
        
        if not data_point:
            logger.warning(f"Weather data point with ID {data_id} not found")
            return None
        
        # Convert WKB geometry to GeoJSON
        location_shape = to_shape(data_point.location)
        location_geojson = mapping(location_shape)
        
        # Convert to response model
        response = WeatherDataResponse(
            id=data_point.id,
            source=data_point.source,
            timestamp=data_point.timestamp,
            data_type=data_point.data_type,
            value=data_point.value,
            unit=data_point.unit,
            station_id=data_point.station_id,
            station_name=data_point.station_name,
            location=location_geojson,
            metadata=json.loads(data_point.metadata) if isinstance(data_point.metadata, str) else data_point.metadata
        )
        
        logger.info(f"Retrieved weather data point with ID {data_id}")
        return response
    
    except Exception as e:
        logger.error(f"Error retrieving weather data point {data_id}: {e}", exc_info=True)
        raise

async def create_weather_data_point(
    db: AsyncSession, 
    data: Dict[str, Any]
) -> WeatherDataResponse:
    """
    Create a new weather data point
    
    Args:
        db: Database session
        data: Weather data point data
        
    Returns:
        Created weather data point
    """
    try:
        # Create new weather data point
        weather_data_point = WeatherData(**data)
        
        # Add to database
        db.add(weather_data_point)
        await db.commit()
        await db.refresh(weather_data_point)
        
        # Get the created data point
        return await get_weather_data_by_id(db, weather_data_point.id)
    
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating weather data point: {e}", exc_info=True)
        raise

async def get_weather_statistics(
    db: AsyncSession,
    data_type: str,
    bbox: List[float],  # [min_lon, min_lat, max_lon, max_lat]
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    interval: str = 'daily'  # 'hourly', 'daily', 'weekly', 'monthly'
) -> WeatherStatsResponse:
    """
    Get statistical aggregations of weather data
    
    Args:
        db: Database session
        data_type: Type of weather data (e.g., 'temperature', 'precipitation')
        bbox: Bounding box for spatial filtering
        start_date: Start date for time filtering
        end_date: End date for time filtering
        interval: Time interval for aggregation
        
    Returns:
        Weather statistics
    """
    try:
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            # Default to 30 days before end_date
            start_date = end_date - timedelta(days=30)
        
        # Create spatial filter
        min_lon, min_lat, max_lon, max_lat = bbox
        bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
        bbox_wkb = from_shape(bbox_geom, srid=4326)
        
        # Define time interval for grouping
        if interval == 'hourly':
            time_bucket = func.date_trunc('hour', WeatherData.timestamp)
        elif interval == 'daily':
            time_bucket = func.date_trunc('day', WeatherData.timestamp)
        elif interval == 'weekly':
            time_bucket = func.date_trunc('week', WeatherData.timestamp)
        elif interval == 'monthly':
            time_bucket = func.date_trunc('month', WeatherData.timestamp)
        else:
            # Default to daily
            time_bucket = func.date_trunc('day', WeatherData.timestamp)
        
        # Build query for aggregation
        stmt = select(
            time_bucket.label('timestamp'),
            func.avg(WeatherData.value).label('avg_value'),
            func.min(WeatherData.value).label('min_value'),
            func.max(WeatherData.value).label('max_value'),
            func.count(WeatherData.id).label('count')
        ).where(
            WeatherData.data_type == data_type,
            WeatherData.timestamp.between(start_date, end_date),
            func.ST_Within(WeatherData.location, bbox_wkb)
        ).group_by(
            time_bucket
        ).order_by(
            time_bucket
        )
        
        # Execute query
        result = await db.execute(stmt)
        time_series = result.fetchall()
        
        # Build time series data
        time_series_data = [
            {
                'timestamp': ts.timestamp,
                'avg_value': float(ts.avg_value) if ts.avg_value else None,
                'min_value': float(ts.min_value) if ts.min_value else None,
                'max_value': float(ts.max_value) if ts.max_value else None,
                'count': ts.count
            }
            for ts in time_series
        ]
        
        # Calculate overall statistics
        stmt_overall = select(
            func.avg(WeatherData.value).label('avg_value'),
            func.min(WeatherData.value).label('min_value'),
            func.max(WeatherData.value).label('max_value'),
            func.count(WeatherData.id).label('count')
        ).where(
            WeatherData.data_type == data_type,
            WeatherData.timestamp.between(start_date, end_date),
            func.ST_Within(WeatherData.location, bbox_wkb)
        )
        
        # Execute query
        result_overall = await db.execute(stmt_overall)
        overall = result_overall.fetchone()
        
        # Get a sample data point to determine unit
        stmt_sample = select(WeatherData.unit).where(
            WeatherData.data_type == data_type
        ).limit(1)
        
        result_sample = await db.execute(stmt_sample)
        sample = result_sample.scalar()
        unit = sample if sample else ""
        
        # Build response
        response = WeatherStatsResponse(
            data_type=data_type,
            start_date=start_date,
            end_date=end_date,
            interval=interval,
            unit=unit,
            bbox=bbox,
            time_series=time_series_data,
            overall={
                'avg_value': float(overall.avg_value) if overall.avg_value else None,
                'min_value': float(overall.min_value) if overall.min_value else None,
                'max_value': float(overall.max_value) if overall.max_value else None,
                'count': overall.count
            }
        )
        
        logger.info(f"Generated weather statistics for {data_type} with {len(time_series_data)} time points")
        return response
    
    except Exception as e:
        logger.error(f"Error generating weather statistics: {e}", exc_info=True)
        raise

async def get_weather_heatmap_data(
    db: AsyncSession,
    data_type: str,
    bbox: List[float],  # [min_lon, min_lat, max_lon, max_lat]
    timestamp: datetime,
    resolution: float = 0.1  # degrees
) -> Dict[str, Any]:
    """
    Get weather data for generating a heatmap
    
    Args:
        db: Database session
        data_type: Type of weather data (e.g., 'temperature', 'precipitation')
        bbox: Bounding box for spatial filtering
        timestamp: Timestamp for the data (will use closest available)
        resolution: Grid resolution in degrees
        
    Returns:
        Grid data for heatmap visualization
    """
    try:
        # Define time window (get data within 6 hours of requested time)
        time_window = 6
        start_time = timestamp - timedelta(hours=time_window)
        end_time = timestamp + timedelta(hours=time_window)
        
        # Create spatial filter
        min_lon, min_lat, max_lon, max_lat = bbox
        bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
        bbox_wkb = from_shape(bbox_geom, srid=4326)
        
        # Get weather data points in the area and time window
        stmt = select(WeatherData).where(
            WeatherData.data_type == data_type,
            WeatherData.timestamp.between(start_time, end_time),
            func.ST_Within(WeatherData.location, bbox_wkb)
        )
        
        # Execute query
        result = await db.execute(stmt)
        weather_points = result.scalars().all()
        
        # If no data found, return empty grid
        if not weather_points:
            logger.warning(f"No weather data found for {data_type} at {timestamp}")
            return {
                'data_type': data_type,
                'timestamp': timestamp,
                'bbox': bbox,
                'resolution': resolution,
                'unit': '',
                'grid_points': []
            }
        
        # Extract unit from first point
        unit = weather_points[0].unit
        
        # Create a grid of points
        grid_points = []
        
        # Generate grid points with interpolated values
        # This is a simplified approach - in a real system you would use proper
        # spatial interpolation algorithms like IDW, Kriging, etc.
        
        lon_steps = int((max_lon - min_lon) / resolution) + 1
        lat_steps = int((max_lat - min_lat) / resolution) + 1
        
        for i in range(lon_steps):
            for j in range(lat_steps):
                lon = min_lon + i * resolution
                lat = min_lat + j * resolution
                
                # Simple inverse distance weighting for demonstration
                total_weight = 0.0
                weighted_sum = 0.0
                
                for point in weather_points:
                    # Get point coordinates
                    point_shape = to_shape(point.location)
                    point_lon, point_lat = point_shape.x, point_shape.y
                    
                    # Calculate distance
                    distance = ((lon - point_lon) ** 2 + (lat - point_lat) ** 2) ** 0.5
                    
                    # Avoid division by zero
                    if distance < 0.0001:
                        # If very close, just use the point's value
                        weighted_sum = point.value
                        total_weight = 1.0
                        break
                    
                    # Inverse distance weight
                    weight = 1.0 / (distance ** 2)
                    weighted_sum += weight * point.value
                    total_weight += weight
                
                if total_weight > 0:
                    interpolated_value = weighted_sum / total_weight
                    
                    grid_points.append({
                        'lon': lon,
                        'lat': lat,
                        'value': float(interpolated_value)
                    })
        
        # Build response
        response = {
            'data_type': data_type,
            'timestamp': timestamp,
            'bbox': bbox,
            'resolution': resolution,
            'unit': unit,
            'grid_points': grid_points
        }
        
        logger.info(f"Generated weather heatmap data with {len(grid_points)} grid points")
        return response
    
    except Exception as e:
        logger.error(f"Error generating weather heatmap data: {e}", exc_info=True)
        raise
