#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${CASHFLOW_REPO_URL:-https://github.com/evosoftwares/cashflow-challenge-Gabriel.git}"
APP_DIR="${CASHFLOW_APP_DIR:-/opt/cashflow}"
DOMAIN_OR_IP="${1:-${APP_DOMAIN:-}}"
ACME_EMAIL="${ACME_EMAIL:-admin@example.com}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: curl -fsSL <script-url> | sudo bash"
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap supports Ubuntu/Debian servers with apt-get."
  exit 1
fi

random_secret() {
  openssl rand -hex 32
}

detect_public_ip() {
  curl -fsSL https://api.ipify.org || curl -fsSL https://ifconfig.me
}

install_docker() {
  apt-get update
  apt-get install -y ca-certificates curl git openssl rsync ufw

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
}

configure_firewall() {
  ufw allow OpenSSH >/dev/null || true
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
  if ufw status | grep -q "Status: active"; then
    ufw reload >/dev/null || true
  fi
}

checkout_repository() {
  mkdir -p "$(dirname "${APP_DIR}")"

  if [ -d "${APP_DIR}/.git" ]; then
    git -C "${APP_DIR}" fetch origin main
    git -C "${APP_DIR}" reset --hard origin/main
  else
    rm -rf "${APP_DIR}"
    git clone "${REPO_URL}" "${APP_DIR}"
  fi
}

write_environment() {
  cd "${APP_DIR}"

  if [ -z "${DOMAIN_OR_IP}" ]; then
    PUBLIC_IP="$(detect_public_ip)"
    COMPOSE_DOMAIN=":80"
    ORIGIN="http://${PUBLIC_IP}"
  elif [[ "${DOMAIN_OR_IP}" == http://* || "${DOMAIN_OR_IP}" == https://* ]]; then
    ORIGIN="${DOMAIN_OR_IP}"
    COMPOSE_DOMAIN="${DOMAIN_OR_IP#http://}"
    COMPOSE_DOMAIN="${COMPOSE_DOMAIN#https://}"
  elif [[ "${DOMAIN_OR_IP}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    COMPOSE_DOMAIN=":80"
    ORIGIN="http://${DOMAIN_OR_IP}"
  else
    COMPOSE_DOMAIN="${DOMAIN_OR_IP}"
    ORIGIN="https://${DOMAIN_OR_IP}"
  fi

  if [ -f .env.production ]; then
    echo ".env.production already exists; keeping existing secrets and settings."
    return
  fi

  cat > .env.production <<EOF
APP_DOMAIN=${COMPOSE_DOMAIN}
APP_ORIGIN=${ORIGIN}
ACME_EMAIL=${ACME_EMAIL}

API_KEY=$(random_secret)
POSTGRES_PASSWORD=$(random_secret)
RABBITMQ_DEFAULT_USER=cashflow
RABBITMQ_DEFAULT_PASS=$(random_secret)

DATABASE_POOL_SIZE=25
DATABASE_MAX_OVERFLOW=35
DATABASE_POOL_TIMEOUT=12
REALTIME_POLL_INTERVAL_SECONDS=2
VITE_API_BASE_URL=/api
EOF

  chmod 600 .env.production
}

start_stack() {
  cd "${APP_DIR}"
  docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
}

print_result() {
  cd "${APP_DIR}"
  APP_ORIGIN_VALUE="$(grep '^APP_ORIGIN=' .env.production | cut -d= -f2-)"

  echo
  echo "Cash Flow is running."
  echo "Portal: ${APP_ORIGIN_VALUE}"
  echo "Health: ${APP_ORIGIN_VALUE}/api/health"
  echo
  echo "Services:"
  docker compose --env-file .env.production -f docker-compose.prod.yml ps
  echo
  echo "Production secrets are stored in ${APP_DIR}/.env.production"
}

install_docker
configure_firewall
checkout_repository
write_environment
start_stack
print_result
