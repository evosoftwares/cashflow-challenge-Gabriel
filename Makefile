.PHONY: up down test load-test logs stop-worker start-worker

up:
	docker compose up --build

down:
	docker compose down

test:
	pytest

load-test:
	k6 run tests/load/daily_balance_50rps.js

logs:
	docker compose logs -f

stop-worker:
	docker compose stop worker

start-worker:
	docker compose start worker
