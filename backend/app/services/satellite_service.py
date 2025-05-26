import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import box, mapping
import json

from app.models.spatial_data import SatelliteImage
from app.schemas.satellite import SatelliteImageQuery, SatelliteImageResponse

logger = logging.getLogger(__name__)

async def get_satellite_images(
    db: AsyncSession, 
    query: SatelliteImageQuery
) -> List[SatelliteImageResponse]:
    """
    Retrieve satellite images based on filtering criteria
    
    Args:
        db: Database session
        query: Query parameters for filtering
        
    Returns:
        List of satellite images matching the criteria
    """
    try:
        # Build query
        stmt = select(SatelliteImage)
        
        # Apply filters
        if query.source:
            stmt = stmt.where(SatelliteImage.source == query.source)
        
        if query.start_date:
            stmt = stmt.where(SatelliteImage.acquisition_date >= query.start_date)
        
        if query.end_date:
            stmt = stmt.where(SatelliteImage.acquisition_date <= query.end_date)
        
        if query.min_resolution is not None:
            stmt = stmt.where(SatelliteImage.resolution >= query.min_resolution)
        
        if query.max_cloud_cover is not None:
            stmt = stmt.where(SatelliteImage.cloud_cover_percentage <= query.max_cloud_cover)
        
        # Apply spatial filter if bbox is provided
        if query.bbox:
            min_lon, min_lat, max_lon, max_lat = query.bbox
            bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
            bbox_wkb = from_shape(bbox_geom, srid=4326)
            stmt = stmt.where(func.ST_Intersects(SatelliteImage.footprint, bbox_wkb))
        
        # Apply pagination
        stmt = stmt.offset(query.offset).limit(query.limit)
        
        # Order by acquisition date (newest first)
        stmt = stmt.order_by(SatelliteImage.acquisition_date.desc())
        
        # Execute query
        result = await db.execute(stmt)
        satellite_images = result.scalars().all()
        
        # Convert to response models
        responses = []
        for image in satellite_images:
            # Convert WKB geometries to GeoJSON
            footprint_shape = to_shape(image.footprint)
            footprint_geojson = mapping(footprint_shape)
            
            center_point_shape = to_shape(image.center_point)
            center_point_geojson = mapping(center_point_shape)
            
            # Convert to response model
            response = SatelliteImageResponse(
                id=image.id,
                source=image.source,
                acquisition_date=image.acquisition_date,
                cloud_cover_percentage=image.cloud_cover_percentage,
                resolution=image.resolution,
                bands=image.bands,
                path=image.path,
                footprint=footprint_geojson,
                center_point=center_point_geojson,
                metadata=json.loads(image.metadata) if isinstance(image.metadata, str) else image.metadata
            )
            responses.append(response)
        
        logger.info(f"Retrieved {len(responses)} satellite images")
        return responses
    
    except Exception as e:
        logger.error(f"Error retrieving satellite images: {e}", exc_info=True)
        raise

async def get_satellite_image_by_id(
    db: AsyncSession, 
    image_id: int
) -> Optional[SatelliteImageResponse]:
    """
    Get a specific satellite image by ID
    
    Args:
        db: Database session
        image_id: ID of the satellite image
        
    Returns:
        Satellite image if found, None otherwise
    """
    try:
        # Build query
        stmt = select(SatelliteImage).where(SatelliteImage.id == image_id)
        
        # Execute query
        result = await db.execute(stmt)
        image = result.scalars().first()
        
        if not image:
            logger.warning(f"Satellite image with ID {image_id} not found")
            return None
        
        # Convert WKB geometries to GeoJSON
        footprint_shape = to_shape(image.footprint)
        footprint_geojson = mapping(footprint_shape)
        
        center_point_shape = to_shape(image.center_point)
        center_point_geojson = mapping(center_point_shape)
        
        # Convert to response model
        response = SatelliteImageResponse(
            id=image.id,
            source=image.source,
            acquisition_date=image.acquisition_date,
            cloud_cover_percentage=image.cloud_cover_percentage,
            resolution=image.resolution,
            bands=image.bands,
            path=image.path,
            footprint=footprint_geojson,
            center_point=center_point_geojson,
            metadata=json.loads(image.metadata) if isinstance(image.metadata, str) else image.metadata
        )
        
        logger.info(f"Retrieved satellite image with ID {image_id}")
        return response
    
    except Exception as e:
        logger.error(f"Error retrieving satellite image {image_id}: {e}", exc_info=True)
        raise

async def create_satellite_image(
    db: AsyncSession, 
    image_data: Dict[str, Any]
) -> SatelliteImageResponse:
    """
    Create a new satellite image record
    
    Args:
        db: Database session
        image_data: Satellite image data
        
    Returns:
        Created satellite image
    """
    try:
        # Create new satellite image
        satellite_image = SatelliteImage(**image_data)
        
        # Add to database
        db.add(satellite_image)
        await db.commit()
        await db.refresh(satellite_image)
        
        # Get the created image
        return await get_satellite_image_by_id(db, satellite_image.id)
    
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating satellite image: {e}", exc_info=True)
        raise

async def get_satellite_image_statistics(
    db: AsyncSession,
    source: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    bbox: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Get statistics about satellite images
    
    Args:
        db: Database session
        source: Filter by source
        start_date: Filter by start date
        end_date: Filter by end date
        bbox: Geographic bounding box
        
    Returns:
        Dictionary with statistics
    """
    try:
        # Build base query
        count_query = select(func.count(SatelliteImage.id))
        avg_cloud_query = select(func.avg(SatelliteImage.cloud_cover_percentage))
        latest_date_query = select(func.max(SatelliteImage.acquisition_date))
        
        # Apply filters
        if source:
            count_query = count_query.where(SatelliteImage.source == source)
            avg_cloud_query = avg_cloud_query.where(SatelliteImage.source == source)
            latest_date_query = latest_date_query.where(SatelliteImage.source == source)
        
        if start_date:
            count_query = count_query.where(SatelliteImage.acquisition_date >= start_date)
            avg_cloud_query = avg_cloud_query.where(SatelliteImage.acquisition_date >= start_date)
            latest_date_query = latest_date_query.where(SatelliteImage.acquisition_date >= start_date)
        
        if end_date:
            count_query = count_query.where(SatelliteImage.acquisition_date <= end_date)
            avg_cloud_query = avg_cloud_query.where(SatelliteImage.acquisition_date <= end_date)
            latest_date_query = latest_date_query.where(SatelliteImage.acquisition_date <= end_date)
        
        # Apply spatial filter if bbox is provided
        if bbox:
            min_lon, min_lat, max_lon, max_lat = bbox
            bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
            bbox_wkb = from_shape(bbox_geom, srid=4326)
            
            count_query = count_query.where(func.ST_Intersects(SatelliteImage.footprint, bbox_wkb))
            avg_cloud_query = avg_cloud_query.where(func.ST_Intersects(SatelliteImage.footprint, bbox_wkb))
            latest_date_query = latest_date_query.where(func.ST_Intersects(SatelliteImage.footprint, bbox_wkb))
        
        # Execute queries
        count_result = await db.execute(count_query)
        avg_cloud_result = await db.execute(avg_cloud_query)
        latest_date_result = await db.execute(latest_date_query)
        
        total_images = count_result.scalar() or 0
        avg_cloud_cover = avg_cloud_result.scalar() or 0
        latest_date = latest_date_result.scalar()
        
        # Get counts by source
        source_counts = {}
        if total_images > 0:
            source_query = select(SatelliteImage.source, func.count(SatelliteImage.id)).group_by(SatelliteImage.source)
            
            # Apply same filters
            if start_date:
                source_query = source_query.where(SatelliteImage.acquisition_date >= start_date)
            if end_date:
                source_query = source_query.where(SatelliteImage.acquisition_date <= end_date)
            if bbox:
                source_query = source_query.where(func.ST_Intersects(SatelliteImage.footprint, bbox_wkb))
                
            source_result = await db.execute(source_query)
            for src, count in source_result.all():
                source_counts[src] = count
        
        # Calculate coverage area (simplified approach)
        coverage_area_km2 = 0
        if bbox:
            # For simplicity, we're using the coverage of the bounding box
            # In a real implementation, we would calculate the actual union of all footprints
            min_lon, min_lat, max_lon, max_lat = bbox
            bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
            coverage_area_km2 = bbox_geom.area * 111 * 111  # Rough conversion from degrees to km²
        
        # Build statistics response
        statistics = {
            "total_images": total_images,
            "images_by_source": source_counts,
            "avg_cloud_cover": avg_cloud_cover,
            "latest_acquisition_date": latest_date,
            "coverage_area_km2": coverage_area_km2
        }
        
        logger.info(f"Generated satellite image statistics: {total_images} images")
        return statistics
    
    except Exception as e:
        logger.error(f"Error generating satellite image statistics: {e}", exc_info=True)
        raise
