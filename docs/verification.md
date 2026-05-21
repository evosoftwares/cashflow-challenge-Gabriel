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
26 passed
```

Cobertura relevante adicionada para realtime, observabilidade, offline e overload:

- `GET /daily-balances/{date}/stream` emite evento SSE `daily_balance`.
- O portal atualiza o `Resumo do dia` a partir do stream sem acionamento manual.
- O contrato de log JSON metrificado inclui `log_schema_version`, `event`, `component` e `metric`.
- `GET /metrics` expõe contadores de requisição HTTP e lançamentos criados.
- `POST /transactions` aceita `client_request_id` opcional.
- Reenvio com o mesmo `client_request_id` retorna a transação existente sem duplicar `transactions` nem `outbox_events`.
- O engine SQLAlchemy aplica limites configuráveis de pool para suportar overload de escrita no ambiente Docker.

Testes do front-end:

```bash
npm --prefix frontend test
npm --prefix frontend run build
```

Resultado:

```text
19 passed
vite build completed successfully
```

Validação local final também confirmou:

```text
26 passed
19 passed
vite build completed successfully
```

Validação de produção para VPS/VM:

```bash
docker compose --env-file .env.production.example -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production.example -f docker-compose.prod.yml build frontend api
```

Resultado:

```text
config valid
frontend image built
api image built
```

Essa validação confirma que o Compose de produção, o proxy Caddy, o front-end estático, a API e as variáveis obrigatórias estão coerentes para execução em uma VM. A publicação real em cloud depende de uma VM criada e de acesso SSH.

Runtime Docker validado:

```text
GET /health  -> 200 OK
GET /metrics -> 200 OK
```

## Auditoria QA do banco de dados

Comandos executados contra o PostgreSQL real do Docker Compose:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT * FROM alembic_version;"
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname;"
docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
docker compose exec -T api alembic current
```

Resultado validado:

```text
alembic_version: 202605200002
tabelas: alembic_version, daily_balances, outbox_events, processed_events, transactions
fila transaction.created: 0 mensagens, 0 unacknowledged
alembic current: 202605200002 (head)
```

Contrato das tabelas validado no banco:

| Tabela | Validação |
| --- | --- |
| `transactions` | `UUID` como PK, `client_request_id` único, `type` restrito a `CREDIT`/`DEBIT`, `amount NUMERIC(14,2)` com `amount > 0`, índice `(merchant_id, occurred_at)`. |
| `daily_balances` | `UUID` como PK, `merchant_id`, `balance_date`, totais `NUMERIC(14,2)`, unique `(merchant_id, balance_date)`. |
| `processed_events` | `event_id` como PK e FK `transaction_id` para `transactions(id)`. |
| `outbox_events` | `UUID` como PK, `payload JSON`, `status` restrito a `PENDING`/`PUBLISHED`/`FAILED`, índice `(status, created_at)`. |

Fluxo API + banco validado:

```text
POST /transactions com client_request_id -> 201 Created
Reenvio com mesmo client_request_id -> 201 Created com o mesmo id
Banco: 1 transação, 1 client_request_id, 1 evento Outbox
Worker: 1 evento processado em processed_events
GET /daily-balances/{date} -> saldo consolidado esperado
Valor negativo -> 422
Endpoint protegido sem API Key -> 401
```

Conclusão da auditoria de banco: o schema real está alinhado às migrations Alembic, aos modelos SQLAlchemy, ao fluxo de negócio e aos requisitos do desafio.

Smoke test funcional em Docker:

```text
POST CREDIT 100.00 -> 201 Created
POST DEBIT 35.00  -> 201 Created
GET /transactions -> 2 movimentações
GET /daily-balances/2026-05-20 -> balance 65.00
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
Running upgrade 202605200001 -> 202605200002, add transaction client request id
```

No Docker Compose, a tabela `alembic_version` retornou:

```text
202605200002
```

A versão `202605200002` adiciona `transactions.client_request_id` e o índice único `uq_transactions_client_request_id`.

## Fluxo online/offline do portal

Cobertura automatizada do front-end:

- queda de rede/API no `POST /transactions` salva movimentação em IndexedDB;
- a tabela mostra contador de pendências e selo `Pendente`;
- o evento `online` do navegador dispara sincronização automática;
- fila existente é sincronizada ao carregar o portal;
- falha `401` não entra na fila offline e mostra erro ao operador.

Cobertura de contrato no backend:

- cliente antigo sem `client_request_id` continua funcionando;
- cliente com `client_request_id` ganha reenvio idempotente;
- duplicidade não cria novo evento em `outbox_events`.

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
http_reqs......................: 3001   50.009661/s
http_req_failed................: 0.00%  0 out of 3001
checks_succeeded...............: 100.00% 3001 out of 3001
```

O resultado atende ao requisito de 50 requisicoes por segundo com falha inferior a 5%.

## Testes de overload

Os testes de overload estão documentados em `docs/overload-tests.md`.

Comandos:

```bash
make overload-read
make overload-worker
```

Resultados observados:

- Overload de leitura: 8931 requisições em 30 segundos, 297.675591 rps, 0.00% de falha.
- Overload com worker parado: 500 lançamentos enviados, 500 respostas `201`, fila `transaction.created` acumulou 500 mensagens e drenou após religar o worker.
- Saldo final do cenário de backlog: `500.00`.

## Checklist de aderencia

O arquivo `docs/compliance-checklist.md` mapeia cada requisito do avaliador para a evidencia correspondente no repositorio.
