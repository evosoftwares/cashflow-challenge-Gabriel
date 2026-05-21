$ErrorActionPreference = "Stop"

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists "docker")) {
    Write-Host "Docker was not found. Install Docker Desktop for Windows and try again." -ForegroundColor Red
    exit 1
}

try {
    docker info *> $null
}
catch {
    Write-Host "Docker is not running. Start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example."
}

Write-Host "Starting Cash Flow locally with Docker Compose..."
Write-Host ""
Write-Host "Portal:  http://localhost:5173"
Write-Host "API:     http://localhost:8000"
Write-Host "Swagger: http://localhost:8000/docs"
Write-Host "Rabbit:  http://localhost:15672"
Write-Host ""

docker compose up --build
