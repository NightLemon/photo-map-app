<#
.SYNOPSIS
    Start only the FastAPI backend with hot-reload
.DESCRIPTION
    Assumes PostgreSQL and Azurite are already running (via docker-compose.dev.yml)
#>
$ROOT = $PSScriptRoot
Push-Location "$ROOT\backend"
& .\.venv\Scripts\Activate.ps1
Write-Host "Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Green
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Pop-Location
