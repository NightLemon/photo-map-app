<#
.SYNOPSIS
    Start only infrastructure (PostgreSQL + Azurite) and run DB migrations
#>
$ROOT = $PSScriptRoot

Write-Host "Starting PostgreSQL & Azurite..." -ForegroundColor Yellow
docker compose -f "$ROOT\docker-compose.dev.yml" up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker compose failed. Is Docker Desktop running?" -ForegroundColor Red
    exit 1
}

# Wait for DB
Write-Host "Waiting for PostgreSQL..." -ForegroundColor Yellow
$retry = 0
while ($retry -lt 30) {
    $result = docker exec (docker compose -f "$ROOT\docker-compose.dev.yml" ps -q db) pg_isready -U photomap 2>&1
    if ($result -match "accepting connections") { break }
    Start-Sleep -Seconds 1
    $retry++
}

# Run migrations
Write-Host "Running migrations..." -ForegroundColor Yellow
Push-Location "$ROOT\backend"
& .\.venv\Scripts\Activate.ps1
alembic upgrade head
Pop-Location

Write-Host ""
Write-Host "Infrastructure ready!" -ForegroundColor Green
Write-Host "  PostgreSQL: localhost:5432 (user: photomap, pass: photomap, db: photomap)" -ForegroundColor Cyan
Write-Host "  Azurite:    localhost:10000 (Blob Storage emulator)" -ForegroundColor Cyan
