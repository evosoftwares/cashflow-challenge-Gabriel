#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-local-dev-key}"
MERCHANT_ID="${MERCHANT_ID:-8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11}"
BALANCE_DATE="${BALANCE_DATE:-2026-05-20}"

echo "Resetting local Docker Compose environment..."
docker compose down -v --remove-orphans
docker compose up --build -d

wait_for_health() {
  for _ in $(seq 1 60); do
    if curl -fsS "${API_URL}/health" >/dev/null 2>/dev/null; then
      return 0
    fi
    sleep 1
  done

  echo "API healthcheck did not become ready" >&2
  docker compose ps >&2
  return 1
}

post_transaction() {
  local type="$1"
  local amount="$2"
  local description="$3"
  local output_file="$4"

  curl -sS -o "${output_file}" -w "%{http_code}" \
    -X POST "${API_URL}/transactions" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d "{
      \"merchant_id\": \"${MERCHANT_ID}\",
      \"type\": \"${type}\",
      \"amount\": \"${amount}\",
      \"description\": \"${description}\",
      \"occurred_at\": \"${BALANCE_DATE}T10:00:00\"
    }"
}

assert_balance() {
  local expected_credit="$1"
  local expected_debit="$2"
  local expected_balance="$3"

  python3 - "$expected_credit" "$expected_debit" "$expected_balance" <<'PY'
import json
import os
import sys
import time
import urllib.request

expected_credit, expected_debit, expected_balance = sys.argv[1:4]
api_url = os.environ.get("API_URL", "http://localhost:8000")
api_key = os.environ.get("API_KEY", "local-dev-key")
merchant_id = os.environ.get("MERCHANT_ID", "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11")
balance_date = os.environ.get("BALANCE_DATE", "2026-05-20")
request = urllib.request.Request(
    f"{api_url}/daily-balances/{balance_date}?merchant_id={merchant_id}",
    headers={"X-API-Key": api_key},
)

last_error = None
for _ in range(60):
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if (
            payload["total_credit"] == expected_credit
            and payload["total_debit"] == expected_debit
            and payload["balance"] == expected_balance
        ):
            print(json.dumps(payload, sort_keys=True))
            sys.exit(0)
        last_error = payload
    except Exception as exc:
        last_error = str(exc)
    time.sleep(1)

raise SystemExit(f"Balance did not match expected values. Last result: {last_error}")
PY
}

queue_messages() {
  docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged \
    | awk '$1 == "transaction.created" {print $2}'
}

wait_for_queue_messages() {
  local expected="$1"
  for _ in $(seq 1 30); do
    local messages
    messages="$(queue_messages)"
    if [ "${messages}" = "${expected}" ]; then
      return 0
    fi
    sleep 1
  done

  echo "Queue did not reach expected message count: ${expected}" >&2
  docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged >&2
  return 1
}

wait_for_health

echo "Creating baseline credit and debit transactions..."
status="$(post_transaction CREDIT 120.00 "Docker E2E credit" /tmp/cashflow_e2e_credit.json)"
[ "${status}" = "201" ] || { cat /tmp/cashflow_e2e_credit.json >&2; exit 1; }

status="$(post_transaction DEBIT 40.00 "Docker E2E debit" /tmp/cashflow_e2e_debit.json)"
[ "${status}" = "201" ] || { cat /tmp/cashflow_e2e_debit.json >&2; exit 1; }

assert_balance "120.00" "40.00" "80.00"
wait_for_queue_messages "0"

echo "Stopping worker and verifying transaction creation remains available..."
docker compose stop worker
status="$(post_transaction CREDIT 100.00 "Docker E2E worker stopped" /tmp/cashflow_e2e_resilience.json)"
[ "${status}" = "201" ] || { cat /tmp/cashflow_e2e_resilience.json >&2; exit 1; }
wait_for_queue_messages "1"

echo "Restarting worker and verifying queued event is consolidated..."
docker compose start worker
assert_balance "220.00" "40.00" "180.00"
wait_for_queue_messages "0"

echo "Docker E2E passed."
