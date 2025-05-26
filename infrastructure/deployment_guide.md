# VisionEarth Deployment Guide

This guide provides comprehensive instructions for deploying the VisionEarth platform on cloud infrastructure. The platform consists of several components that can be deployed separately and scaled independently based on demand.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Options](#deployment-options)
4. [AWS Deployment](#aws-deployment)
5. [Google Cloud Platform Deployment](#google-cloud-platform-deployment)
6. [Azure Deployment](#azure-deployment)
7. [Database Setup](#database-setup)
8. [Containerization](#containerization)
9. [CI/CD Pipeline](#cicd-pipeline)
10. [Scaling Strategies](#scaling-strategies)
11. [Monitoring and Logging](#monitoring-and-logging)
12. [Security Considerations](#security-considerations)
13. [Cost Optimization](#cost-optimization)

## Architecture Overview

VisionEarth consists of the following main components:

- **Frontend**: React application with CesiumJS integration for 3D Earth visualization
- **Backend API**: FastAPI application for serving data and managing user requests
- **Database**: PostgreSQL with PostGIS extension for spatial data storage
- **AI Module**: TensorFlow/PyTorch models for satellite image processing and anomaly detection
- **Data Pipeline**: Services for ingesting and processing satellite and weather data
- **Storage**: Object storage for raw and processed data, images, and model artifacts

The components communicate through well-defined APIs and can be deployed separately or together.

## Prerequisites

Before deploying VisionEarth, ensure you have:

- Cloud provider account (AWS, GCP, or Azure)
- Docker and Docker Compose installed (for local testing)
- Kubectl CLI (for Kubernetes deployments)
- Terraform (optional, for infrastructure as code)
- Domain name (optional, for production deployments)
- SSL certificates (for HTTPS)
- API keys for external data providers (NASA, NOAA, Sentinel Hub)

## Deployment Options

VisionEarth can be deployed in various ways:

1. **Monolithic Deployment**: All components on a single server (suitable for development)
2. **Microservices Deployment**: Components as separate services (recommended for production)
3. **Serverless Deployment**: Using serverless functions for some components (advanced option)

## AWS Deployment

### Infrastructure Setup

```bash
# Create VPC and networking infrastructure
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=visionearth-vpc}]'

# Create subnets, internet gateway, route tables, etc.
# (Detailed steps omitted for brevity)
```

### Frontend Deployment (AWS Amplify or S3 + CloudFront)

Option 1: AWS Amplify
```bash
# Initialize Amplify in your frontend directory
cd visionearth/frontend
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

Option 2: S3 + CloudFront
```bash
# Create S3 bucket
aws s3 mb s3://visionearth-frontend

# Build the React app
npm run build

# Upload to S3
aws s3 sync build/ s3://visionearth-frontend

# Set up CloudFront distribution
# (Configuration steps omitted for brevity)
```

### Backend Deployment (ECS or EKS)

Using ECS with Fargate:
```bash
# Create ECR repository
aws ecr create-repository --repository-name visionearth-backend

# Build and push Docker image
docker build -t visionearth-backend ./visionearth/backend
docker tag visionearth-backend:latest [your-aws-account-id].dkr.ecr.[region].amazonaws.com/visionearth-backend:latest
aws ecr get-login-password | docker login --username AWS --password-stdin [your-aws-account-id].dkr.ecr.[region].amazonaws.com
docker push [your-aws-account-id].dkr.ecr.[region].amazonaws.com/visionearth-backend:latest

# Create ECS cluster, task definition, and service
# (Configuration steps omitted for brevity)
```

### Database Deployment (RDS)

```bash
# Create PostgreSQL RDS instance with PostGIS
aws rds create-db-instance \
    --db-instance-identifier visionearth-db \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --allocated-storage 100 \
    --master-username visionearth \
    --master-user-password [secure-password] \
    --vpc-security-group-ids [security-group-id] \
    --db-subnet-group-name [subnet-group-name]

# After creation, connect and enable PostGIS
# psql -h [rds-endpoint] -U visionearth -d visionearth
# CREATE EXTENSION postgis;
```

### AI Module and Data Pipeline (ECS or Batch)

```bash
# Similar to backend deployment, create ECR repositories and push Docker images
# Set up ECS tasks or Batch jobs for scheduled processing
```

### Load Balancer and API Gateway

```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
    --name visionearth-alb \
    --subnets [subnet-ids] \
    --security-groups [security-group-id]

# Create target groups and listeners
# (Configuration steps omitted for brevity)

# Set up API Gateway for backend services
# (Configuration steps omitted for brevity)
```

## Google Cloud Platform Deployment

### Frontend Deployment (Firebase or Cloud Storage + Cloud CDN)

Option 1: Firebase Hosting
```bash
# Initialize Firebase in your frontend directory
cd visionearth/frontend
firebase init hosting

# Build and deploy
npm run build
firebase deploy --only hosting
```

Option 2: Cloud Storage + Cloud CDN
```bash
# Create Cloud Storage bucket
gsutil mb -l [region] gs://visionearth-frontend

# Build and upload
npm run build
gsutil -m cp -r build/* gs://visionearth-frontend

# Set up Cloud CDN
# (Configuration steps omitted for brevity)
```

### Backend Deployment (GKE or Cloud Run)

Using Cloud Run:
```bash
# Build and push Docker image
cd visionearth/backend
gcloud builds submit --tag gcr.io/[project-id]/visionearth-backend

# Deploy to Cloud Run
gcloud run deploy visionearth-backend \
    --image gcr.io/[project-id]/visionearth-backend \
    --platform managed \
    --region [region] \
    --allow-unauthenticated
```

### Database Deployment (Cloud SQL)

```bash
# Create PostgreSQL Cloud SQL instance
gcloud sql instances create visionearth-db \
    --database-version=POSTGRES_13 \
    --tier=db-custom-2-4096 \
    --region=[region]

# Create database
gcloud sql databases create visionearth --instance=visionearth-db

# Connect and enable PostGIS
# (Configuration steps omitted for brevity)
```

### AI Module and Data Pipeline (GKE, Cloud Run, or Dataflow)

```bash
# Similar to backend deployment for containerized services
# For data processing, consider Cloud Dataflow or Cloud Composer (Airflow)
```

## Azure Deployment

### Frontend Deployment (Static Web Apps or Blob Storage + CDN)

Option 1: Static Web Apps
```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Build and deploy
cd visionearth/frontend
npm run build
swa deploy ./build
```

Option 2: Blob Storage + CDN
```bash
# Create storage account and enable static website hosting
az storage account create \
    --name visionearthfrontend \
    --resource-group visionearth-rg \
    --location [region] \
    --sku Standard_LRS

az storage blob service-properties update \
    --account-name visionearthfrontend \
    --static-website \
    --index-document index.html \
    --404-document index.html

# Upload files
cd visionearth/frontend
npm run build
az storage blob upload-batch \
    --account-name visionearthfrontend \
    --source ./build \
    --destination '$web'

# Set up Azure CDN
# (Configuration steps omitted for brevity)
```

### Backend Deployment (AKS or App Service)

Using App Service:
```bash
# Create App Service plan
az appservice plan create \
    --name visionearth-plan \
    --resource-group visionearth-rg \
    --sku B1 \
    --is-linux

# Create and deploy web app
az webapp create \
    --resource-group visionearth-rg \
    --plan visionearth-plan \
    --name visionearth-backend \
    --runtime "PYTHON:3.9"

# Deploy code
az webapp deployment source config-local-git \
    --name visionearth-backend \
    --resource-group visionearth-rg
```

### Database Deployment (Azure Database for PostgreSQL)

```bash
# Create PostgreSQL server
az postgres server create \
    --name visionearth-db \
    --resource-group visionearth-rg \
    --location [region] \
    --admin-user visionearth \
    --admin-password [secure-password] \
    --sku-name GP_Gen5_2

# Create database
az postgres db create \
    --name visionearth \
    --server-name visionearth-db \
    --resource-group visionearth-rg

# Enable PostGIS extension
# (Connect to the database and run CREATE EXTENSION postgis;)
```

### AI Module and Data Pipeline (AKS, Container Instances, or Functions)

```bash
# Deploy containerized services using AKS or Container Instances
# For data processing, consider Azure Data Factory or Azure Functions
```

## Database Setup

After deploying your PostgreSQL database with PostGIS extension, initialize the schema:

```bash
# Connect to the database
psql -h [database-host] -U [username] -d visionearth

# Run the schema creation script
\i database/schema.sql
```

## Containerization

The VisionEarth components are containerized using Docker. Here's how to build and run containers locally:

```bash
# Build images
docker build -t visionearth-frontend ./visionearth/frontend
docker build -t visionearth-backend ./visionearth/backend
docker build -t visionearth-ai-module ./visionearth/ai_module
docker build -t visionearth-data-pipeline ./visionearth/data_pipeline

# Run containers
docker-compose up -d
```

## CI/CD Pipeline

Set up a CI/CD pipeline using GitHub Actions, GitLab CI, Jenkins, or cloud provider-specific tools.

Example GitHub Actions workflow:

```yaml
name: VisionEarth CI/CD

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.9
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run tests
        run: |
          cd backend
          pytest

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v2
      
      # Frontend build and deploy
      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: 16
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      - name: Build
        run: |
          cd frontend
          npm run build
      
      # Deploy steps would depend on your chosen cloud provider
      # (Deployment steps omitted for brevity)
```

## Scaling Strategies

### Frontend Scaling
- Use CDN for static assets
- Scale horizontally by adding more instances behind a load balancer
- Use edge caching for API responses

### Backend Scaling
- Scale API servers horizontally based on CPU/memory usage
- Use auto-scaling groups or Kubernetes HPA
- Implement caching using Redis for frequent queries

### Database Scaling
- Use read replicas for query-heavy workloads
- Consider sharding for very large datasets
- Implement connection pooling
- Use PgBouncer for connection management

### AI Module Scaling
- Use GPU instances for inference
- Scale prediction services based on queue size
- Consider batch processing for non-real-time tasks

### Data Pipeline Scaling
- Scale workers horizontally for parallel data processing
- Use distributed processing frameworks like Spark for large datasets
- Implement backpressure mechanisms for data surges

## Monitoring and Logging

Set up comprehensive monitoring and logging:

- **Infrastructure Monitoring**: CloudWatch (AWS), Stackdriver (GCP), or Azure Monitor
- **Application Monitoring**: Prometheus + Grafana or cloud-native solutions
- **Centralized Logging**: ELK Stack (Elasticsearch, Logstash, Kibana) or cloud-native solutions
- **Alerts**: Set up alerts for system failures, performance degradation, and security issues
- **Tracing**: Use OpenTelemetry for distributed tracing

## Security Considerations

- Use VPC/VNET for network isolation
- Implement HTTPS for all endpoints
- Use IAM roles and service accounts with least privilege
- Store secrets in secure locations (Secrets Manager, Key Vault, etc.)
- Implement WAF and DDoS protection
- Use secure coding practices and regular security scanning
- Set up database encryption at rest and in transit
- Implement proper authentication and authorization
- Conduct regular security audits

## Cost Optimization

- Use spot/preemptible instances for batch processing
- Implement auto-scaling to match demand
- Use tiered storage for infrequently accessed data
- Set up budget alerts and cost monitoring
- Consider reserved instances for stable workloads
- Optimize database queries and indexes
- Use caching to reduce API calls and database load

---

This deployment guide provides a high-level overview of deploying the VisionEarth platform. Specific implementation details may vary based on your requirements and chosen technologies. For production deployments, consider consulting with cloud architects and DevOps specialists to ensure optimal performance, security, and cost-efficiency.
