# start_all.ps1
# PowerShell script to start both Node and Python ML services for local development (no Docker required)

$ErrorActionPreference = 'Stop'

Write-Host "Activating Python venv and starting ML service..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd python_ml_service; .\.venv\Scripts\Activate.ps1; uvicorn app:app --host 127.0.0.1 --port 8000' -WindowStyle Minimized

Start-Sleep -Seconds 3

Write-Host "Starting Node backend (server.js)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'node server.js' -WindowStyle Minimized

Write-Host "Both services started in new terminals. Press Ctrl+C in each to stop."
