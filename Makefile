.PHONY: up down migrate test docker-e2e load-test overload-read overload-worker logs stop-worker start-worker

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

logs:
	docker compose logs -f

stop-worker:
	docker compose stop worker

start-worker:
	docker compose start worker
