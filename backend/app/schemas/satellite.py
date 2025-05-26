from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from geojson import Polygon, Point

class SatelliteImageBase(BaseModel):
    source: str
    acquisition_date: datetime
    cloud_cover_percentage: float
    resolution: float
    bands: List[str]
    
class SatelliteImageQuery(BaseModel):
    source: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_resolution: Optional[float] = None
    max_cloud_cover: Optional[float] = None
    bbox: Optional[List[float]] = None  # [min_lon, min_lat, max_lon, max_lat]
    limit: int = 20
    offset: int = 0

class SatelliteImageCreate(SatelliteImageBase):
    path: str
    metadata: Dict[str, Any] = {}
    footprint: Polygon
    center_point: Point

class SatelliteImageResponse(SatelliteImageBase):
    id: int
    path: str
    footprint: Dict[str, Any]  # GeoJSON Polygon
    center_point: Dict[str, Any]  # GeoJSON Point
    metadata: Dict[str, Any]
    
    class Config:
        orm_mode = True

class SatelliteImageStats(BaseModel):
    total_images: int
    images_by_source: Dict[str, int]
    avg_cloud_cover: float
    latest_acquisition_date: datetime
    coverage_area_km2: float
