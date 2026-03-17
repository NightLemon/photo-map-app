<#
.SYNOPSIS
    Start only the Vite frontend dev server
#>
$ROOT = $PSScriptRoot
Push-Location "$ROOT\frontend"
Write-Host "Starting Vite frontend on http://localhost:5173 ..." -ForegroundColor Green
npx vite --host 0.0.0.0 --port 5173
Pop-Location
