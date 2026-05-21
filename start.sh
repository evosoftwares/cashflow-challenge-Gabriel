#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker nao foi encontrado. Instale o Docker Desktop ou Docker Engine e tente novamente."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker nao esta rodando. Abra o Docker Desktop ou inicie o servico do Docker e tente novamente."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Arquivo .env criado a partir do .env.example."
fi

echo "Iniciando o Cash Flow localmente com Docker Compose..."
echo
echo "Portal:  http://localhost:5173"
echo "API:     http://localhost:8000"
echo "Swagger: http://localhost:8000/docs"
echo "Rabbit:  http://localhost:15672"
echo

docker compose up --build
