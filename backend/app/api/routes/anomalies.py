from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from app.db.session import get_db
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/anomalies", tags=["anomalies"])
logger = logging.getLogger(__name__)

# Sample anomaly data for demonstration
SAMPLE_ANOMALIES = [
    {
        "id": 1,
        "anomaly_type": "wildfire",
        "detection_date": "2023-05-10T14:30:00Z",
        "confidence_score": 0.92,
        "description": "Active wildfire detected in forest area",
        "severity": "high",
        "status": "detected",
        "location": {
            "type": "Point",
            "coordinates": [-122.45, 37.75]
        }
    },
    {
        "id": 2,
        "anomaly_type": "deforestation",
        "detection_date": "2023-05-08T10:15:00Z",
        "confidence_score": 0.87,
        "description": "Forest clearing detected",
        "severity": "medium",
        "status": "verified",
        "location": {
            "type": "Polygon",
            "coordinates": [[
                [-122.42, 37.78],
                [-122.40, 37.78],
                [-122.40, 37.76],
                [-122.42, 37.76],
                [-122.42, 37.78]
            ]]
        }
    },
    {
        "id": 3,
        "anomaly_type": "flood",
        "detection_date": "2023-05-15T08:45:00Z",
        "confidence_score": 0.95,
        "description": "Flooding detected in riverside area",
        "severity": "high",
        "status": "detected",
        "location": {
            "type": "Polygon",
            "coordinates": [[
                [-122.25, 37.85],
                [-122.22, 37.85],
                [-122.22, 37.82],
                [-122.25, 37.82],
                [-122.25, 37.85]
            ]]
        }
    }
]

@router.get("/", response_model=List[Dict[str, Any]])
async def list_anomalies(
    anomaly_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    bbox_min_lon: Optional[float] = Query(None, description="Minimum longitude of bounding box"),
    bbox_min_lat: Optional[float] = Query(None, description="Minimum latitude of bounding box"),
    bbox_max_lon: Optional[float] = Query(None, description="Maximum longitude of bounding box"),
    bbox_max_lat: Optional[float] = Query(None, description="Maximum latitude of bounding box"),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List environmental anomalies with filtering options
    """
    try:
        # This is a mock implementation - in a real app, this would query the database
        filtered_anomalies = SAMPLE_ANOMALIES.copy()
        
        # Apply filters
        if anomaly_type:
            filtered_anomalies = [a for a in filtered_anomalies if a["anomaly_type"] == anomaly_type]
        
        if start_date:
            filtered_anomalies = [a for a in filtered_anomalies if datetime.fromisoformat(a["detection_date"].replace("Z", "+00:00")) >= start_date]
        
        if end_date:
            filtered_anomalies = [a for a in filtered_anomalies if datetime.fromisoformat(a["detection_date"].replace("Z", "+00:00")) <= end_date]
        
        if min_confidence > 0:
            filtered_anomalies = [a for a in filtered_anomalies if a["confidence_score"] >= min_confidence]
        
        if severity:
            filtered_anomalies = [a for a in filtered_anomalies if a["severity"] == severity]
        
        if status:
            filtered_anomalies = [a for a in filtered_anomalies if a["status"] == status]
        
        # Apply spatial filter if bounding box is provided
        if all(x is not None for x in [bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat]):
            # This is a simplified spatial filter - in a real app, we would use PostGIS
            # For point geometries
            filtered_anomalies = [
                a for a in filtered_anomalies 
                if (a["location"]["type"] == "Point" and
                    bbox_min_lon <= a["location"]["coordinates"][0] <= bbox_max_lon and
                    bbox_min_lat <= a["location"]["coordinates"][1] <= bbox_max_lat)
                # For polygon geometries, this is a very simplified check
                or (a["location"]["type"] == "Polygon" and
                    any(bbox_min_lon <= coord[0] <= bbox_max_lon and
                        bbox_min_lat <= coord[1] <= bbox_max_lat
                        for coord in a["location"]["coordinates"][0]))
            ]
        
        # Apply pagination
        paginated_anomalies = filtered_anomalies[offset:offset + limit]
        
        return paginated_anomalies
    
    except Exception as e:
        logger.error(f"Error retrieving anomalies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while retrieving anomalies: {str(e)}"
        )

@router.get("/{anomaly_id}", response_model=Dict[str, Any])
async def get_anomaly(
    anomaly_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific anomaly by ID
    """
    try:
        # Find anomaly by ID
        for anomaly in SAMPLE_ANOMALIES:
            if anomaly["id"] == anomaly_id:
                return anomaly
        
        # If anomaly not found, raise 404 error
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anomaly with ID {anomaly_id} not found"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving anomaly {anomaly_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while retrieving the anomaly: {str(e)}"
        )

@router.get("/types", response_model=List[str])
async def get_anomaly_types(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a list of available anomaly types
    """
    try:
        # This would typically query the database for distinct anomaly types
        # For this demo, return a predefined list
        anomaly_types = ["wildfire", "deforestation", "flood", "oil_spill", "urban_growth", "algal_bloom"]
        return anomaly_types
    
    except Exception as e:
        logger.error(f"Error retrieving anomaly types: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while retrieving anomaly types: {str(e)}"
        )
