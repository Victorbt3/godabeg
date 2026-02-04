# Start Python ML Service
cd "$PSScriptRoot\python_ml_service"
Write-Host "Starting Python ML Service on port 8000..." -ForegroundColor Green
python -u app_simple.py
