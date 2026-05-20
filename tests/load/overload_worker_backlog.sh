#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-local-dev-key}"
BALANCE_DATE="${BALANCE_DATE:-2026-05-21}"
COUNT="${COUNT:-500}"
CONCURRENCY="${CONCURRENCY:-50}"

new_uuid() {
  python3 - <<'PY'
import uuid

print(uuid.uuid4())
PY
}

MERCHANT_ID="${MERCHANT_ID:-$(new_uuid)}"

cleanup() {
  docker compose start worker >/dev/null 2>&1 || true
}

trap cleanup EXIT

docker compose stop worker

initial_queue="$(docker compose exec -T rabbitmq rabbitmqctl list_queues name messages | awk '$1 == "transaction.created" {print $2}')"
initial_pending="$(docker compose exec -T postgres psql -U cashflow -d cashflow -tAc "SELECT count(*) FROM outbox_events WHERE status = 'PENDING';")"

if [ "${initial_queue:-0}" != "0" ] || [ "${initial_pending}" != "0" ]; then
  echo "Expected an empty queue and no pending outbox events before starting."
  echo "initial_queue=${initial_queue:-0} initial_pending_outbox=${initial_pending}"
  exit 1
fi

echo "merchant_id=${MERCHANT_ID} balance_date=${BALANCE_DATE} count=${COUNT} concurrency=${CONCURRENCY}"

API_URL="${API_URL}" \
API_KEY="${API_KEY}" \
MERCHANT_ID="${MERCHANT_ID}" \
BALANCE_DATE="${BALANCE_DATE}" \
COUNT="${COUNT}" \
CONCURRENCY="${CONCURRENCY}" \
python3 - <<'PY'
import concurrent.futures
import json
import os
import time
import urllib.error
import urllib.request
from collections import Counter

api_url = f"{os.environ['API_URL']}/transactions"
api_key = os.environ["API_KEY"]
merchant_id = os.environ["MERCHANT_ID"]
balance_date = os.environ["BALANCE_DATE"]
count = int(os.environ["COUNT"])
concurrency = int(os.environ["CONCURRENCY"])


def post_one(index: int):
    payload = {
        "merchant_id": merchant_id,
        "type": "CREDIT",
        "amount": "1.00",
        "description": f"Overload simulation #{index}",
        "occurred_at": f"{balance_date}T10:00:00",
    }
    request = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "X-API-Key": api_key},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
            return response.status
    except urllib.error.HTTPError as exc:
        exc.read()
        return exc.code
    except Exception as exc:
        return type(exc).__name__


start = time.perf_counter()
with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
    results = list(executor.map(post_one, range(1, count + 1)))
elapsed = time.perf_counter() - start

print(json.dumps({
    "sent": count,
    "concurrency": concurrency,
    "elapsed_seconds": round(elapsed, 2),
    "approx_rps": round(count / elapsed, 2),
    "statuses": dict(Counter(results)),
}, sort_keys=True))
PY

echo "Waiting for Outbox Dispatcher to publish pending events..."
for i in $(seq 1 60); do
  pending="$(docker compose exec -T postgres psql -U cashflow -d cashflow -tAc "SELECT count(*) FROM outbox_events WHERE status = 'PENDING';")"
  queue="$(docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged | awk '$1 == "transaction.created" {print $2}')"
  echo "publish_wait=${i} pending_outbox=${pending} queue_messages=${queue}"
  if [ "${pending}" = "0" ] && [ "${queue}" = "${COUNT}" ]; then
    break
  fi
  sleep 1
done

docker compose exec -T postgres psql -U cashflow -d cashflow \
  -c "SELECT status, count(*) FROM outbox_events GROUP BY status ORDER BY status;"
docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged

echo "Restarting worker and waiting for backlog drain..."
start="$(date +%s)"
docker compose start worker

for i in $(seq 1 120); do
  queue="$(docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged | awk '$1 == "transaction.created" {print $2":"$3}')"
  balance="$(docker compose exec -T postgres psql -U cashflow -d cashflow -tAc "SELECT COALESCE(balance::text, 'missing') FROM daily_balances WHERE merchant_id = '${MERCHANT_ID}' AND balance_date = '${BALANCE_DATE}';")"
  processed="$(docker compose exec -T postgres psql -U cashflow -d cashflow -tAc "SELECT count(*) FROM processed_events pe JOIN transactions t ON t.id = pe.transaction_id WHERE t.merchant_id = '${MERCHANT_ID}';")"
  elapsed="$(( $(date +%s) - start ))"
  echo "drain_wait=${i} elapsed=${elapsed}s queue=${queue} balance=${balance:-missing} processed=${processed}"
  if [ "${queue}" = "0:0" ] && [ "${balance}" = "${COUNT}.00" ] && [ "${processed}" = "${COUNT}" ]; then
    break
  fi
  sleep 1
done

docker compose exec -T postgres psql -U cashflow -d cashflow \
  -c "SELECT merchant_id, balance_date, total_credit, total_debit, balance FROM daily_balances WHERE merchant_id = '${MERCHANT_ID}';"
docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
