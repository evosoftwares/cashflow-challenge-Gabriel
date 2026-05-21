.PHONY: up down migrate test docker-e2e load-test overload-read overload-worker frontend-install frontend-test frontend-build frontend-dev prod-config prod-build prod-up prod-down logs stop-worker start-worker

up:
	docker compose up --build

down:
	docker compose down

migrate:
	docker compose run --rm migrate

test:
	pytest

docker-e2e:
	bash tests/integration/docker_e2e.sh

load-test:
	k6 run tests/load/daily_balance_50rps.js

overload-read:
	k6 run tests/load/overload_read_300rps.js

overload-worker:
	bash tests/load/overload_worker_backlog.sh

frontend-install:
	npm --prefix frontend install

frontend-test:
	npm --prefix frontend test

frontend-build:
	npm --prefix frontend run build

frontend-dev:
	npm --prefix frontend run dev -- --host 0.0.0.0

prod-config:
	docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet

prod-build:
	docker compose --env-file .env.production -f docker-compose.prod.yml build

prod-up:
	docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose --env-file .env.production -f docker-compose.prod.yml down

logs:
	docker compose logs -f

stop-worker:
	docker compose stop worker

start-worker:
	docker compose start worker
