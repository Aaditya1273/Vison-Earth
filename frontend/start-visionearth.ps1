# PowerShell script to start VisionEarth application
# This script sets the required environment variables and starts the development server

# Set the NODE_OPTIONS environment variable to use the legacy OpenSSL provider
$env:NODE_OPTIONS="--openssl-legacy-provider"

# Start the React development server
Write-Host "Starting VisionEarth development server with legacy OpenSSL provider..." -ForegroundColor Green
npm start
