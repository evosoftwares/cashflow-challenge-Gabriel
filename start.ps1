$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists "docker")) {
    Write-Host "Docker nao foi encontrado. Instale o Docker Desktop para Windows e tente novamente." -ForegroundColor Red
    Write-Host "Guia oficial: https://docs.docker.com/desktop/setup/install/windows-install/" -ForegroundColor Yellow
    Write-Host "Depois de instalar, abra o Docker Desktop e execute este script novamente." -ForegroundColor Yellow
    exit 1
}

try {
    docker info *> $null
}
catch {
    Write-Host "Docker nao esta rodando. Abra o Docker Desktop e tente novamente." -ForegroundColor Red
    Write-Host "Quando o Docker Desktop indicar que esta em execucao, rode .\start.bat novamente." -ForegroundColor Yellow
    exit 1
}

try {
    docker compose version *> $null
}
catch {
    Write-Host "Docker Compose nao foi encontrado. Atualize ou reinstale o Docker Desktop." -ForegroundColor Red
    Write-Host "Guia oficial: https://docs.docker.com/desktop/setup/install/windows-install/" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Arquivo .env criado a partir do .env.example."
}

Write-Host "Iniciando o Cash Flow localmente com Docker Compose..."
Write-Host ""
Write-Host "Portal:  http://localhost:5173"
Write-Host "API:     http://localhost:8000"
Write-Host "Swagger: http://localhost:8000/docs"
Write-Host "Rabbit:  http://localhost:15672"
Write-Host ""

docker compose up --build
