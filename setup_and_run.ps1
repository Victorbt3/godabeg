<#
PowerShell helper to install Node & Python dependencies (local), then start docker-compose.
Run in an Administrator shell to ensure permissions.
#>

$ErrorActionPreference = 'Stop'

Write-Host "Installing Node dependencies..." -ForegroundColor Cyan
if (Test-Path package.json) { npm install } else { Write-Host "No package.json found" }

Write-Host "Setting up Python environment for ML service..." -ForegroundColor Cyan
$pyDir = "python_ml_service"
if (Test-Path $pyDir) {
    Push-Location $pyDir
    if (-not (Test-Path ".venv")) { python -m venv .venv }
    .\.venv\Scripts\Activate.ps1
    pip install --upgrade pip
    pip install -r requirements.txt
    Pop-Location
} else {
    Write-Host "No python_ml_service folder found" -ForegroundColor Yellow
}

Write-Host "Building and starting containers via docker-compose..." -ForegroundColor Cyan
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    docker-compose up --build -d
    Write-Host "Containers started. Use 'docker-compose ps' to inspect." -ForegroundColor Green
} else {
    Write-Host "docker-compose not found. Install Docker Desktop and ensure docker-compose is in PATH." -ForegroundColor Red
}
