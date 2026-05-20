# Evidencias de Verificacao

Este arquivo registra os comandos executados para validar a entrega localmente em Docker Compose.

## Ambiente

- Docker: `Docker version 29.4.3`
- Docker Compose: `Docker Compose version v5.1.3`
- k6: `k6 v2.0.0`

## Testes automatizados

Comando:

```bash
PATH=.venv/bin:$PATH pytest -q
```

Resultado:

```text
16 passed
```

## Migrations

Comando:

```bash
DATABASE_URL=sqlite+pysqlite:////tmp/cashflow_alembic_check.db \
PATH=.venv/bin:$PATH alembic upgrade head
```

Resultado:

```text
Running upgrade  -> 202605200001, initial schema
```

No Docker Compose, a tabela `alembic_version` retornou:

```text
202605200001
```

## Validacao end-to-end Docker

Comando:

```bash
make docker-e2e
```

O script reseta o ambiente local do Docker Compose, executa migrations, valida API, PostgreSQL, Outbox Dispatcher, RabbitMQ, worker e resiliencia com worker parado.

Resultado:

```text
Docker E2E passed.
```

Healthcheck validado pelo script:

```bash
curl http://localhost:8000/health
```

Resultado:

```json
{"status":"ok"}
```

Fluxo validado pelo script:

1. `POST /transactions` com `CREDIT 120.00`.
2. `POST /transactions` com `DEBIT 40.00`.
3. Outbox Dispatcher publica os eventos pendentes no RabbitMQ.
4. Worker consome os eventos e consolida com upsert atomico.
5. `GET /daily-balances/2026-05-20`.
6. `docker compose stop worker`.
7. `POST /transactions` com worker parado retorna `201 Created`.
8. RabbitMQ mantem uma mensagem pendente publicada pelo Outbox Dispatcher.
9. `docker compose start worker`.
10. Worker consome a mensagem pendente e atualiza o saldo.

Resultado do consolidado:

```json
{
  "merchant_id": "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
  "date": "2026-05-20",
  "total_credit": "120.00",
  "total_debit": "40.00",
  "balance": "80.00"
}
```

## Resultado do teste de resiliencia

Comandos cobertos por `make docker-e2e`:

```bash
docker compose stop worker
docker compose start worker
```

Com o worker parado, `POST /transactions` continuou retornando `201 Created`.

Antes de reiniciar o worker, a fila tinha uma mensagem pendente:

```text
transaction.created 1 0
```

O saldo foi atualizado para:

```json
{
  "merchant_id": "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
  "date": "2026-05-20",
  "total_credit": "220.00",
  "total_debit": "40.00",
  "balance": "180.00"
}
```

A fila voltou para:

```text
transaction.created 0 0
```

## Teste de carga

Comando:

```bash
k6 run tests/load/daily_balance_50rps.js
```

Resultado:

```text
http_reqs......................: 3001   50.01052/s
http_req_failed................: 0.00%
checks_succeeded...............: 100.00% 3001 out of 3001
```

O resultado atende ao requisito de 50 requisicoes por segundo com falha inferior a 5%.

## Checklist de aderencia

O arquivo `docs/compliance-checklist.md` mapeia cada requisito do avaliador para a evidencia correspondente no repositorio.
