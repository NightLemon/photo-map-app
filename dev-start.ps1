<#
.SYNOPSIS
    Start local development environment for PhotoMap
.DESCRIPTION
    1. Starts PostgreSQL + Azurite via Docker Compose
    2. Waits for DB to be ready
    3. Runs Alembic migrations
    4. Starts backend (FastAPI) and frontend (Vite) in parallel
#>

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PhotoMap - Local Dev Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── Step 1: Start infrastructure containers ───
Write-Host "[1/4] Starting PostgreSQL & Azurite..." -ForegroundColor Yellow
docker compose -f "$ROOT\docker-compose.dev.yml" up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker compose failed. Is Docker Desktop running?" -ForegroundColor Red
    Write-Host "       Start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# ─── Step 2: Wait for PostgreSQL ───
Write-Host "[2/4] Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxRetries = 30
$retry = 0
while ($retry -lt $maxRetries) {
    $result = docker exec (docker compose -f "$ROOT\docker-compose.dev.yml" ps -q db) pg_isready -U photomap 2>&1
    if ($result -match "accepting connections") {
        break
    }
    Start-Sleep -Seconds 1
    $retry++
}
if ($retry -eq $maxRetries) {
    Write-Host "ERROR: PostgreSQL did not become ready in time" -ForegroundColor Red
    exit 1
}
Write-Host "  PostgreSQL is ready!" -ForegroundColor Green

# ─── Step 3: Run migrations ───
Write-Host "[3/4] Running database migrations..." -ForegroundColor Yellow
Push-Location "$ROOT\backend"
& .\.venv\Scripts\Activate.ps1
alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Migration failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  Migrations complete!" -ForegroundColor Green
Pop-Location

# ─── Step 4: Start services ───
Write-Host "[4/4] Starting Backend & Frontend..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Backend:  http://localhost:8000/api/health" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

# Start backend in background
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\backend"
    & "$root\backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $ROOT

# Start frontend in background
$frontendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\frontend"
    npx vite --host 0.0.0.0 --port 5173
} -ArgumentList $ROOT

try {
    # Stream output from both jobs
    while ($true) {
        $backendJob, $frontendJob | ForEach-Object {
            Receive-Job -Job $_ -ErrorAction SilentlyContinue | ForEach-Object {
                Write-Host $_
            }
        }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`nStopping services..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
