# Start both services locally for quick testing
# This does NOT use Docker - runs directly on Windows

Write-Host "Starting Godabeg services..." -ForegroundColor Green
Write-Host ""

# Check if Node is installed
try {
    $node_version = node --version
    Write-Host "✓ Node.js found: $node_version" -ForegroundColor Green
}
catch {
    Write-Host "✗ Node.js not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

# Check if Python is installed
try {
    $python_version = python --version
    Write-Host "✓ Python found: $python_version" -ForegroundColor Green
}
catch {
    Write-Host "✗ Python not found. Please install Python 3.9+" -ForegroundColor Red
    exit 1
}

# Install Node dependencies if needed
Write-Host ""
Write-Host "Checking Node dependencies..." -ForegroundColor Yellow
if (-Not (Test-Path ".\node_modules")) {
    Write-Host "Installing npm packages..." -ForegroundColor Yellow
    npm install
}
else {
    Write-Host "✓ npm packages already installed" -ForegroundColor Green
}

# Create Python venv if needed
Write-Host ""
Write-Host "Checking Python environment..." -ForegroundColor Yellow
if (-Not (Test-Path ".\python_ml_service\venv")) {
    Write-Host "Creating Python venv..." -ForegroundColor Yellow
    python -m venv python_ml_service\venv
    & ".\python_ml_service\venv\Scripts\Activate.ps1"
    pip install --upgrade pip
    pip install -r python_ml_service\requirements.txt
    deactivate
}
else {
    Write-Host "✓ Python venv already exists" -ForegroundColor Green
}

# Start services in new windows
Write-Host ""
Write-Host "Starting services..." -ForegroundColor Green

# Start Python ML service in new window
Write-Host "▶ Starting Python ML service on port 8000..." -ForegroundColor Cyan
$python_args = "-Command `"cd python_ml_service; ..\python_ml_service\venv\Scripts\Activate.ps1; uvicorn app:app --host 0.0.0.0 --port 8000`""
Start-Process powershell -ArgumentList $python_args -WindowStyle Normal

# Wait a bit for Python service to start
Start-Sleep -Seconds 3

# Start Node server in new window  
Write-Host "▶ Starting Node proxy server on port 3000..." -ForegroundColor Cyan
$node_args = "-Command `"npm start`""
Start-Process powershell -ArgumentList $node_args -WindowStyle Normal -WorkingDirectory $PSScriptRoot

Write-Host ""
Write-Host "✓ Services starting..." -ForegroundColor Green
Write-Host ""
Write-Host "Frontend:      http://localhost:3000" -ForegroundColor Cyan
Write-Host "Python ML API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs:      http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check the server windows for any errors. Press Ctrl+C in each window to stop." -ForegroundColor Yellow
