-- VisionEarth Database Schema
-- This schema defines the database structure for storing spatial data, satellite imagery metadata,
-- environmental anomalies, and user information

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create schema
CREATE SCHEMA IF NOT EXISTS visionearth;

-- Set search path
SET search_path TO visionearth, public;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    preferences JSONB DEFAULT '{}'::jsonb
);

-- Create index on email and username
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Areas of interest for users
CREATE TABLE user_areas_of_interest (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index
CREATE INDEX idx_user_areas_geom ON user_areas_of_interest USING GIST(geometry);

-- Satellite image sources
CREATE TABLE satellite_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    provider VARCHAR(100),
    base_url VARCHAR(255),
    api_endpoint VARCHAR(255),
    metadata JSONB
);

-- Insert common satellite sources
INSERT INTO satellite_sources (name, description, provider) VALUES
('sentinel-2', 'Sentinel-2 MultiSpectral Instrument', 'ESA'),
('landsat-8', 'Landsat 8 OLI/TIRS', 'NASA/USGS'),
('modis', 'MODIS Terra and Aqua', 'NASA'),
('goes-16', 'GOES-16 Advanced Baseline Imager', 'NOAA'),
('goes-17', 'GOES-17 Advanced Baseline Imager', 'NOAA');

-- Satellite images table
CREATE TABLE satellite_images (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES satellite_sources(id),
    external_id VARCHAR(255),
    title VARCHAR(255),
    acquisition_date TIMESTAMP WITH TIME ZONE,
    ingestion_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cloud_cover_percentage FLOAT,
    path VARCHAR(512),
    resolution FLOAT,
    bands VARCHAR(255)[],
    metadata JSONB,
    footprint GEOMETRY(POLYGON, 4326),
    center_point GEOMETRY(POINT, 4326)
);

-- Create indices
CREATE INDEX idx_satellite_images_acquisition_date ON satellite_images(acquisition_date);
CREATE INDEX idx_satellite_images_source_id ON satellite_images(source_id);
CREATE INDEX idx_satellite_images_footprint ON satellite_images USING GIST(footprint);
CREATE INDEX idx_satellite_images_center_point ON satellite_images USING GIST(center_point);

-- Weather data sources
CREATE TABLE weather_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    provider VARCHAR(100),
    base_url VARCHAR(255),
    api_endpoint VARCHAR(255),
    metadata JSONB
);

-- Insert common weather sources
INSERT INTO weather_sources (name, description, provider) VALUES
('noaa-ghcn', 'Global Historical Climatology Network', 'NOAA'),
('noaa-gfs', 'Global Forecast System', 'NOAA'),
('ecmwf', 'European Centre for Medium-Range Weather Forecasts', 'ECMWF'),
('meteostat', 'Meteostat Weather and Climate Data', 'Meteostat');

-- Weather data table
CREATE TABLE weather_data (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES weather_sources(id),
    station_id VARCHAR(100),
    station_name VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE,
    ingestion_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_type VARCHAR(100),
    value FLOAT,
    unit VARCHAR(50),
    location GEOMETRY(POINT, 4326),
    metadata JSONB
);

-- Create indices
CREATE INDEX idx_weather_data_timestamp ON weather_data(timestamp);
CREATE INDEX idx_weather_data_type ON weather_data(data_type);
CREATE INDEX idx_weather_data_source_id ON weather_data(source_id);
CREATE INDEX idx_weather_data_location ON weather_data USING GIST(location);

-- Anomaly types
CREATE TABLE anomaly_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    severity_threshold FLOAT
);

-- Insert common anomaly types
INSERT INTO anomaly_types (name, description) VALUES
('wildfire', 'Active fire or burn scar detection'),
('deforestation', 'Forest clearing or degradation'),
('flood', 'Water inundation in normally dry areas'),
('drought', 'Abnormal dryness and vegetation stress'),
('oil_spill', 'Oil or chemical spill in water bodies'),
('algal_bloom', 'Harmful algal blooms in water bodies'),
('urban_growth', 'Rapid urban expansion'),
('glacier_retreat', 'Glacier and ice sheet reduction'),
('air_pollution', 'Abnormal air quality conditions');

-- Environmental anomalies table
CREATE TABLE environmental_anomalies (
    id SERIAL PRIMARY KEY,
    anomaly_type_id INTEGER REFERENCES anomaly_types(id),
    detection_date TIMESTAMP WITH TIME ZONE,
    ingestion_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confidence_score FLOAT,
    description TEXT,
    severity VARCHAR(50) CHECK (severity IN ('low', 'medium', 'high')),
    status VARCHAR(50) CHECK (status IN ('detected', 'verified', 'responding', 'monitored', 'resolved')),
    metadata JSONB,
    location GEOMETRY(GEOMETRY, 4326),
    area_sq_km FLOAT
);

-- Create indices
CREATE INDEX idx_anomalies_type ON environmental_anomalies(anomaly_type_id);
CREATE INDEX idx_anomalies_date ON environmental_anomalies(detection_date);
CREATE INDEX idx_anomalies_status ON environmental_anomalies(status);
CREATE INDEX idx_anomalies_severity ON environmental_anomalies(severity);
CREATE INDEX idx_anomalies_location ON environmental_anomalies USING GIST(location);

-- Anomaly evidence (linking anomalies to satellite images)
CREATE TABLE anomaly_evidence (
    anomaly_id INTEGER REFERENCES environmental_anomalies(id) ON DELETE CASCADE,
    satellite_image_id INTEGER REFERENCES satellite_images(id) ON DELETE CASCADE,
    description TEXT,
    PRIMARY KEY (anomaly_id, satellite_image_id)
);

-- User alerts for environmental anomalies
CREATE TABLE user_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    anomaly_id INTEGER REFERENCES environmental_anomalies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read BOOLEAN DEFAULT FALSE,
    notification_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_user_alerts_user_id ON user_alerts(user_id);
CREATE INDEX idx_user_alerts_anomaly_id ON user_alerts(anomaly_id);
CREATE INDEX idx_user_alerts_read ON user_alerts(read);

-- Data processing jobs
CREATE TABLE data_processing_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    parameters JSONB,
    result JSONB,
    error_message TEXT
);

CREATE INDEX idx_jobs_status ON data_processing_jobs(status);
CREATE INDEX idx_jobs_type ON data_processing_jobs(job_type);

-- API requests log
CREATE TABLE api_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_time INTEGER, -- in milliseconds
    response_status INTEGER,
    request_params JSONB
);

CREATE INDEX idx_api_requests_user_id ON api_requests(user_id);
CREATE INDEX idx_api_requests_endpoint ON api_requests(endpoint);
CREATE INDEX idx_api_requests_request_time ON api_requests(request_time);

-- Create a view for active anomalies
CREATE VIEW active_anomalies AS
SELECT a.*, t.name as anomaly_type_name
FROM environmental_anomalies a
JOIN anomaly_types t ON a.anomaly_type_id = t.id
WHERE a.status != 'resolved'
ORDER BY a.detection_date DESC;

-- Create a view for user dashboard
CREATE VIEW user_dashboard AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(DISTINCT a.id) as total_alerts,
    COUNT(DISTINCT CASE WHEN a.read = FALSE THEN a.id END) as unread_alerts,
    COUNT(DISTINCT aoi.id) as areas_of_interest
FROM users u
LEFT JOIN user_alerts a ON u.id = a.user_id
LEFT JOIN user_areas_of_interest aoi ON u.id = aoi.user_id
GROUP BY u.id, u.username;

-- Create a function to automatically create user alerts for anomalies in their areas of interest
CREATE OR REPLACE FUNCTION create_user_alerts_for_anomaly() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_alerts (user_id, anomaly_id)
    SELECT u.id, NEW.id
    FROM users u
    JOIN user_areas_of_interest aoi ON u.id = aoi.user_id
    WHERE ST_Intersects(aoi.geometry, NEW.location);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run the function when a new anomaly is inserted
CREATE TRIGGER trigger_create_user_alerts
AFTER INSERT ON environmental_anomalies
FOR EACH ROW EXECUTE FUNCTION create_user_alerts_for_anomaly();

-- Create a function to update geometry columns with proper SRID
CREATE OR REPLACE FUNCTION ensure_geometry_srid() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.location IS NOT NULL THEN
        NEW.location := ST_SetSRID(NEW.location, 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to ensure proper SRID
CREATE TRIGGER trigger_ensure_anomaly_srid
BEFORE INSERT OR UPDATE ON environmental_anomalies
FOR EACH ROW EXECUTE FUNCTION ensure_geometry_srid();

CREATE TRIGGER trigger_ensure_aoi_srid
BEFORE INSERT OR UPDATE ON user_areas_of_interest
FOR EACH ROW EXECUTE FUNCTION ensure_geometry_srid();
