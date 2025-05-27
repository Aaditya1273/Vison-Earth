# PowerShell script to start VisionEarth application
# This script sets the required environment variables and starts the development server

# Kill any existing node processes (optional - uncomment if needed)
# Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# Set the NODE_OPTIONS environment variable to use the legacy OpenSSL provider
$env:NODE_OPTIONS="--openssl-legacy-provider"

# Check if port 3000 is in use
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Warning: Port 3000 is already in use. Attempting to kill the process..." -ForegroundColor Yellow
    $processId = (Get-NetTCPConnection -LocalPort 3000).OwningProcess
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Write-Host "Process using port 3000 has been terminated." -ForegroundColor Green
}

# Start the React development server
Write-Host "Starting VisionEarth development server with legacy OpenSSL provider..." -ForegroundColor Green
Write-Host "The application will be available at http://localhost:3000" -ForegroundColor Cyan

try {
    npm start
} catch {
    Write-Host "Error starting development server: $_" -ForegroundColor Red
    Write-Host "Trying alternative startup method..." -ForegroundColor Yellow
    npx react-scripts start
}
