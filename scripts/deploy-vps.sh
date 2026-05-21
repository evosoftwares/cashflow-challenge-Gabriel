#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: scripts/deploy-vps.sh user@server [/opt/cashflow]"
  exit 1
fi

TARGET="$1"
REMOTE_DIR="${2:-/opt/cashflow}"

rsync -az --delete \
  --exclude ".git" \
  --exclude ".venv" \
  --exclude "frontend/node_modules" \
  --exclude "frontend/dist" \
  --exclude ".env" \
  ./ "${TARGET}:${REMOTE_DIR}/"

ssh "${TARGET}" "cd ${REMOTE_DIR} && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build"
ssh "${TARGET}" "cd ${REMOTE_DIR} && docker compose --env-file .env.production -f docker-compose.prod.yml ps"
