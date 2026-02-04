# Quick start script for local development (without Docker)
# This starts the Node server and Python ML service directly

$ErrorActionPreference = 'Stop'

Write-Host "=== Starting Fakoya Services ===" -ForegroundColor Cyan

# Install Node dependencies
Write-Host "`n[1/4] Installing Node dependencies..." -ForegroundColor Yellow
if (Test-Path package.json) {
    npm install
} else {
    Write-Host "No package.json found - skipping Node setup" -ForegroundColor Yellow
}

# Setup Python environment
Write-Host "`n[2/4] Setting up Python environment..." -ForegroundColor Yellow
$pyDir = "python_ml_service"
if (Test-Path $pyDir) {
    Push-Location $pyDir
    
    # Create venv if it doesn't exist
    if (-not (Test-Path ".venv")) {
        Write-Host "Creating virtual environment..." -ForegroundColor Cyan
        python -m venv .venv
    }
    
    # Activate venv
    & ".\.venv\Scripts\Activate.ps1"
    
    # Install requirements
    Write-Host "Installing Python requirements..." -ForegroundColor Cyan
    pip install --upgrade pip --quiet
    pip install -r requirements.txt --quiet
    
    Pop-Location
} else {
    Write-Host "No python_ml_service folder found - skipping Python setup" -ForegroundColor Yellow
}

# Start Python service
Write-Host "`n[3/4] Starting Python ML Service on http://localhost:8000..." -ForegroundColor Yellow
$pyScript = {
    Push-Location python_ml_service
    & ".\.venv\Scripts\Activate.ps1"
    uvicorn app:app --host 0.0.0.0 --port 8000 --reload
}
$pyProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $pyScript -PassThru
Write-Host "Python service started (PID: $($pyProcess.Id))" -ForegroundColor Green

# Wait for Python service to start
Start-Sleep -Seconds 3

# Start Node server
Write-Host "`n[4/4] Starting Node server on http://localhost:3000..." -ForegroundColor Yellow
node server.js

Write-Host "`n=== Services Started ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Python ML: http://localhost:8000" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop servers" -ForegroundColor Yellow
