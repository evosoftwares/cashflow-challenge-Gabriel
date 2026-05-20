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
12 passed
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

## Validacao end-to-end

Comando:

```bash
docker compose up --build -d
```

Healthcheck:

```bash
curl http://localhost:8000/health
```

Resultado:

```json
{"status":"ok"}
```

Fluxo validado:

1. `POST /transactions` com `CREDIT 120.00`.
2. `POST /transactions` com `DEBIT 40.00`.
3. `GET /daily-balances/2026-05-20`.

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

## Teste de resiliencia

Comando:

```bash
docker compose stop worker
```

Com o worker parado, `POST /transactions` continuou retornando `201 Created`.

Antes de reiniciar o worker, a fila tinha uma mensagem pendente:

```text
transaction.created 1 0
```

Depois:

```bash
docker compose start worker
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
http_reqs......................: 3001   50.011007/s
http_req_failed................: 0.00%
checks_succeeded...............: 100.00% 3001 out of 3001
```

O resultado atende ao requisito de 50 requisicoes por segundo com falha inferior a 5%.
