from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timedelta
from geojson import Feature, FeatureCollection
import logging

from app.db.base import get_db
from app.models.spatial_data import SatelliteImage
from app.schemas.satellite import SatelliteImageResponse, SatelliteImageQuery
from app.services.satellite_service import get_satellite_images, get_satellite_image_by_id
from app.services.external_apis import fetch_new_satellite_data

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/satellite/images", response_model=List[SatelliteImageResponse])
async def list_satellite_images(
    source: Optional[str] = Query(None, description="Satellite source (e.g., sentinel-2, landsat-8)"),
    start_date: Optional[datetime] = Query(None, description="Start date for filtering images"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering images"),
    min_resolution: Optional[float] = Query(None, description="Minimum resolution in meters per pixel"),
    max_cloud_cover: Optional[float] = Query(None, description="Maximum cloud cover percentage"),
    bbox: Optional[List[float]] = Query(None, description="Bounding box [min_lon, min_lat, max_lon, max_lat]"),
    limit: int = Query(20, description="Maximum number of images to return"),
    offset: int = Query(0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve satellite images based on filtering criteria
    """
    try:
        query = SatelliteImageQuery(
            source=source,
            start_date=start_date,
            end_date=end_date,
            min_resolution=min_resolution,
            max_cloud_cover=max_cloud_cover,
            bbox=bbox,
            limit=limit,
            offset=offset
        )
        
        images = await get_satellite_images(db, query)
        return images
    except Exception as e:
        logger.error(f"Error retrieving satellite images: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving satellite images: {str(e)}")

@router.get("/satellite/images/{image_id}", response_model=SatelliteImageResponse)
async def get_satellite_image(
    image_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve a specific satellite image by ID
    """
    try:
        image = await get_satellite_image_by_id(db, image_id)
        if not image:
            raise HTTPException(status_code=404, detail=f"Satellite image with ID {image_id} not found")
        return image
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving satellite image {image_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving satellite image: {str(e)}")

@router.post("/satellite/refresh")
async def refresh_satellite_data(
    source: Optional[str] = Query(None, description="Satellite source to refresh"),
    days: int = Query(7, description="Number of days to look back for new data"),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a refresh of satellite data from external sources
    """
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        end_date = datetime.utcnow()
        
        result = await fetch_new_satellite_data(db, source, start_date, end_date)
        return {"status": "success", "new_images_count": result["count"]}
    except Exception as e:
        logger.error(f"Error refreshing satellite data: {e}")
        raise HTTPException(status_code=500, detail=f"Error refreshing satellite data: {str(e)}")

@router.get("/satellite/coverage", response_model=FeatureCollection)
async def get_satellite_coverage(
    source: Optional[str] = Query(None, description="Satellite source"),
    start_date: Optional[datetime] = Query(None, description="Start date"),
    end_date: Optional[datetime] = Query(None, description="End date"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get coverage map of satellite imagery as GeoJSON
    """
    try:
        # Implementation would retrieve footprints and convert to GeoJSON
        # This is a simplified placeholder
        features = []
        # Logic to retrieve and convert image footprints to GeoJSON features
        
        return FeatureCollection(features)
    except Exception as e:
        logger.error(f"Error retrieving satellite coverage: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving satellite coverage: {str(e)}")
