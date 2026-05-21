#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker was not found. Install Docker Desktop or Docker Engine and try again."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop or the Docker service and try again."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

echo "Starting Cash Flow locally with Docker Compose..."
echo
echo "Portal:  http://localhost:5173"
echo "API:     http://localhost:8000"
echo "Swagger: http://localhost:8000/docs"
echo "Rabbit:  http://localhost:15672"
echo

docker compose up --build
