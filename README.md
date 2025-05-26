# VisionEarth Platform

VisionEarth is a real-time, interactive 3D globe platform that provides visualization of satellite data, weather patterns, and AI-powered environmental anomaly detection. The platform integrates data from multiple public sources including NASA, NOAA, and Sentinel Hub to deliver a comprehensive view of Earth's environmental conditions.

![VisionEarth Platform](https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2072&q=80)

## Table of Contents

1. [Features](#features)
2. [System Architecture](#system-architecture)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Usage](#usage)
7. [API Documentation](#api-documentation)
8. [Development](#development)
9. [Deployment](#deployment)
10. [Future Enhancements](#future-enhancements)
11. [Contributing](#contributing)
12. [License](#license)

## Features

- **Interactive 3D Earth Visualization**: Built with CesiumJS for high-performance globe rendering
- **Satellite Data Integration**: Real-time access to imagery from Sentinel, Landsat, MODIS, and other sources
- **Weather Data Visualization**: Global weather patterns and historical data
- **AI-Powered Anomaly Detection**: Machine learning models to detect environmental events such as:
  - Wildfires and burn scars
  - Deforestation
  - Floods
  - Droughts
  - Oil spills
  - Harmful algal blooms
- **Time-Series Analysis**: Track environmental changes over time
- **Spatial Database**: PostgreSQL with PostGIS for efficient storage and querying of spatial data
- **Scalable Architecture**: Designed for horizontal scaling and cloud deployment

## System Architecture

VisionEarth is built with a modern, modular architecture consisting of several key components:

### Frontend
- React.js with TypeScript
- CesiumJS for 3D globe visualization
- Material-UI for interface components
- React Query for data fetching and caching

### Backend
- FastAPI (Python) for high-performance API endpoints
- Authentication and authorization
- WebSockets for real-time updates
- Caching layer for performance optimization

### AI Module
- TensorFlow/PyTorch for deep learning models
- U-Net architecture for semantic segmentation
- OpenCV for image processing
- Custom anomaly detection algorithms

### Data Pipeline
- Data ingestion from multiple satellite and weather data sources
- Processing and transformation pipeline
- Scheduled data collection and updates
- Metadata extraction and indexing

### Database
- PostgreSQL with PostGIS extension
- Spatial indexes for efficient geographic queries
- Time-series data storage optimizations
- User data and preferences storage

## Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL 13+ with PostGIS extension
- Docker and Docker Compose (recommended)
- API keys for data providers:
  - NASA Earth Data
  - NOAA API
  - Sentinel Hub
  - Cesium ion (for 3D globe)

## Installation

### Clone the Repository

```bash
git clone https://github.com/yourusername/visionearth.git
cd visionearth
```

### Backend Setup

```bash
# Create a virtual environment
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Create database
createdb visionearth
psql -d visionearth -c "CREATE EXTENSION postgis;"

# Run database migrations
alembic upgrade head

# Start the backend server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy Cesium assets
node copy-cesium.js

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development server
npm start
```

### AI Module Setup

```bash
cd ai_module

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download pre-trained models (if available)
python scripts/download_models.py

# Start the AI service
python service.py
```

### Data Pipeline Setup

```bash
cd data_pipeline

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run a data ingestion job
python orchestrator.py
```

## Configuration

### Environment Variables

The following environment variables need to be set:

#### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Secret key for JWT token generation
- `ALLOW_ORIGINS`: Comma-separated list of allowed CORS origins
- `NASA_API_KEY`: API key for NASA Earth Data
- `NOAA_API_KEY`: API key for NOAA services
- `SENTINEL_HUB_USER`: Username for Sentinel Hub
- `SENTINEL_HUB_PASSWORD`: Password for Sentinel Hub

#### Frontend
- `REACT_APP_API_URL`: URL of the backend API
- `REACT_APP_CESIUM_ACCESS_TOKEN`: Access token for Cesium ion

#### AI Module
- `MODEL_PATH`: Path to pre-trained models
- `GPU_ENABLED`: Set to 'true' to enable GPU acceleration

#### Data Pipeline
- `DATABASE_URL`: PostgreSQL connection string
- `DATA_DIR`: Directory for temporary data storage
- `NASA_API_KEY`: API key for NASA Earth Data
- `NOAA_API_KEY`: API key for NOAA services
- `SENTINEL_HUB_USER`: Username for Sentinel Hub
- `SENTINEL_HUB_PASSWORD`: Password for Sentinel Hub

### Database Configuration

The PostgreSQL database should have the PostGIS extension enabled. Run the schema creation script:

```bash
psql -U your_user -d visionearth -f database/schema.sql
```

## Usage

### Running with Docker Compose

For convenience, you can use Docker Compose to run all components:

```bash
docker-compose up -d
```

This will start the following services:
- Frontend on http://localhost:3000
- Backend API on http://localhost:8000
- AI Module on http://localhost:8001
- PostgreSQL database on port 5432

### Accessing the Application

Open http://localhost:3000 in your web browser to access the VisionEarth platform.

### Demo Accounts

For testing purposes, the following demo accounts are available:

- **Admin**: admin@visionearth.com / password123
- **User**: user@visionearth.com / password123

## API Documentation

The API documentation is available at http://localhost:8000/docs when the backend is running. It provides a comprehensive list of endpoints, request/response formats, and authentication requirements.

Key API endpoints include:

- `/api/v1/satellite/images`: Retrieve satellite imagery
- `/api/v1/weather`: Access weather data
- `/api/v1/anomalies`: Get environmental anomalies
- `/api/v1/auth`: Authentication endpoints
- `/api/v1/users`: User management

## Development

### Project Structure

```
visionearth/
├── frontend/            # React + CesiumJS frontend
├── backend/             # FastAPI backend
├── ai_module/           # AI/ML processing components
├── data_pipeline/       # Data ingestion scripts
├── database/            # Database schemas and migrations
├── infrastructure/      # IaC and deployment configs
└── docs/                # Documentation
```

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes and test locally
3. Write tests for your changes
4. Submit a pull request

### Testing

#### Backend Tests

```bash
cd backend
pytest
```

#### Frontend Tests

```bash
cd frontend
npm test
```

#### AI Module Tests

```bash
cd ai_module
pytest
```

#### Integration Tests

```bash
cd tests
pytest
```

## Deployment

Refer to the detailed [Deployment Guide](./infrastructure/deployment_guide.md) for instructions on deploying VisionEarth to various cloud platforms including AWS, GCP, and Azure.

The platform is designed to be deployed as:
- Containerized microservices using Kubernetes
- Serverless functions for specific components
- Traditional VMs for components with specific hardware requirements

## Future Enhancements

VisionEarth is designed to be extensible. Here are some potential future enhancements:

### Short-term Improvements

- **Mobile Application**: Develop mobile apps for iOS and Android
- **Offline Mode**: Support for downloading data for offline access
- **Enhanced Search**: Advanced search capabilities for finding specific areas or anomalies
- **User Collaboration**: Features for users to collaborate and share insights
- **Custom Alerts**: Configurable alerts for specific regions or anomaly types

### Mid-term Enhancements

- **Additional Data Sources**: Integration with more satellite and weather data providers
- **Advanced Analytics**: Enhanced statistical analysis and predictive modeling
- **3D Terrain Visualization**: Higher resolution terrain models
- **Time-lapse Generation**: Automated creation of time-lapse visualizations
- **API Ecosystem**: Developer API for third-party integrations

### Long-term Vision

- **Global Environmental Monitoring System**: Comprehensive monitoring of Earth's ecosystems
- **Predictive Capabilities**: AI-powered prediction of environmental events
- **Digital Twin of Earth**: Complete digital representation of Earth's systems
- **AR/VR Integration**: Support for augmented and virtual reality experiences
- **Citizen Science Platform**: Engage the public in environmental monitoring and research

## Contributing

Contributions to VisionEarth are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## Acknowledgements

- [Cesium](https://cesium.com/) for the 3D globe visualization library
- [NASA](https://www.nasa.gov/) for Earth observation data
- [NOAA](https://www.noaa.gov/) for weather and climate data
- [ESA](https://www.esa.int/) for Sentinel satellite data
- [FastAPI](https://fastapi.tiangolo.com/) for the API framework
- [React](https://reactjs.org/) for the frontend framework
- [TensorFlow](https://www.tensorflow.org/) and [PyTorch](https://pytorch.org/) for AI capabilities
- [PostgreSQL](https://www.postgresql.org/) and [PostGIS](https://postgis.net/) for spatial database functionality
