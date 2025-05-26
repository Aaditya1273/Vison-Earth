from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Index
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime

from app.db.base import Base

class SatelliteImage(Base):
    """Stores metadata and references to satellite imagery"""
    __tablename__ = "satellite_images"
    
    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, index=True)  # e.g., "sentinel-2", "landsat-8"
    acquisition_date = Column(DateTime, index=True)
    cloud_cover_percentage = Column(Float)
    path = Column(String)  # Path to image file or URL
    resolution = Column(Float)  # in meters per pixel
    bands = Column(ARRAY(String))  # Available bands
    metadata = Column(JSONB)  # Additional metadata
    
    # Spatial data - store the image footprint
    footprint = Column(Geometry('POLYGON', srid=4326))
    center_point = Column(Geometry('POINT', srid=4326))
    
    # Relationships
    anomalies = relationship("EnvironmentalAnomaly", back_populates="source_image")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_satellite_images_acquisition_date', acquisition_date),
        Index('idx_satellite_images_source', source),
        Index('idx_satellite_images_footprint', footprint, postgresql_using='gist'),
    )
    
    def __repr__(self):
        return f"<SatelliteImage(id={self.id}, source={self.source}, date={self.acquisition_date})>"


class WeatherData(Base):
    """Stores weather data points"""
    __tablename__ = "weather_data"
    
    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, index=True)  # e.g., "noaa", "meteostat"
    timestamp = Column(DateTime, index=True)
    data_type = Column(String, index=True)  # e.g., "temperature", "precipitation"
    value = Column(Float)
    unit = Column(String)
    metadata = Column(JSONB)  # Additional metadata
    
    # Spatial data
    location = Column(Geometry('POINT', srid=4326))
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_weather_data_timestamp', timestamp),
        Index('idx_weather_data_type', data_type),
        Index('idx_weather_data_location', location, postgresql_using='gist'),
    )
    
    def __repr__(self):
        return f"<WeatherData(id={self.id}, type={self.data_type}, timestamp={self.timestamp})>"


class EnvironmentalAnomaly(Base):
    """Stores detected environmental anomalies"""
    __tablename__ = "environmental_anomalies"
    
    id = Column(Integer, primary_key=True, index=True)
    anomaly_type = Column(String, index=True)  # e.g., "deforestation", "fire", "pollution"
    detection_date = Column(DateTime, index=True, default=datetime.utcnow)
    confidence_score = Column(Float)  # AI model confidence score
    description = Column(Text)
    severity = Column(String)  # e.g., "low", "medium", "high"
    status = Column(String, default="detected")  # e.g., "detected", "verified", "resolved"
    metadata = Column(JSONB)  # Additional metadata
    
    # Foreign keys
    source_image_id = Column(Integer, ForeignKey("satellite_images.id"))
    
    # Relationships
    source_image = relationship("SatelliteImage", back_populates="anomalies")
    
    # Spatial data
    location = Column(Geometry('GEOMETRY', srid=4326))  # Can be point, line, or polygon
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_anomalies_type', anomaly_type),
        Index('idx_anomalies_date', detection_date),
        Index('idx_anomalies_location', location, postgresql_using='gist'),
    )
    
    def __repr__(self):
        return f"<EnvironmentalAnomaly(id={self.id}, type={self.anomaly_type}, date={self.detection_date})>"


class User(Base):
    """Stores user information"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # User preferences
    preferences = Column(JSONB, default={})
    
    # Areas of interest - spatial data
    areas_of_interest = Column(ARRAY(Geometry('POLYGON', srid=4326)))
    
    # Relationships
    alerts = relationship("UserAlert", back_populates="user")
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class UserAlert(Base):
    """Stores user alerts for environmental anomalies"""
    __tablename__ = "user_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    anomaly_id = Column(Integer, ForeignKey("environmental_anomalies.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    read = Column(Boolean, default=False)
    
    # Relationships
    user = relationship("User", back_populates="alerts")
    
    def __repr__(self):
        return f"<UserAlert(id={self.id}, user_id={self.user_id}, anomaly_id={self.anomaly_id})>"
