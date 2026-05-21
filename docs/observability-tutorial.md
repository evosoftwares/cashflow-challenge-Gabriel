# Tutorial de Observabilidade

Este tutorial mostra como avaliar a saúde do sistema, investigar falhas e acompanhar o fluxo de uma movimentação desde o portal/API até a consolidação diária.

O objetivo não é substituir uma plataforma completa de monitoramento, mas entregar um caminho claro para diagnóstico local e uma base para evolução em produção.

## O Que Podemos Avaliar

| Área | O que avaliar | Sinal saudável | Sinal de problema |
| --- | --- | --- | --- |
| API | Disponibilidade | `/health` responde `200` | `/health` falha ou demora |
| API | Erros HTTP | Baixo volume de `4xx` e `5xx` | Crescimento de `5xx` |
| API | Latência | Requisições rápidas em `/metrics` | Duração aumentando |
| Lançamentos | Criação de créditos e débitos | Contador de transações sobe | POST falha ou não gera Outbox |
| Outbox | Publicação confiável | Eventos `PUBLISHED` | Eventos `PENDING` ou `FAILED` acumulando |
| RabbitMQ | Backlog da fila | Poucas mensagens pendentes | Fila `transaction.created` crescendo |
| Worker | Processamento assíncrono | ACKs e consolidações `success` | Falhas, mensagens `unacknowledged` ou retries |
| Consolidação | Atualização do saldo | `daily_balances` atualizado | Saldo ausente ou atrasado |
| Idempotência | Duplicidade de eventos | Duplicados ignorados | Saldo somado mais de uma vez |
| Portal | Modo offline | Pendências sincronizam quando API volta | Pendências ficam presas no navegador |

## Pré-Requisitos

Suba o ambiente local:

```bash
docker compose up --build
```

Ou use os atalhos:

```bash
./start.sh
```

No Windows:

```powershell
.\start.bat
```

## 1. Verificar Se o Sistema Está Vivo

Use o healthcheck:

```bash
curl http://localhost:8000/health
```

Resposta esperada:

```json
{"status":"ok"}
```

Interpretação:

- `200 OK`: a API está viva.
- erro de conexão: API parada ou Docker indisponível.
- demora excessiva: possível problema de recurso, rede local ou inicialização.

## 2. Verificar Containers

```bash
docker compose ps
```

Serviços esperados:

- `api`
- `frontend`
- `postgres`
- `rabbitmq`
- `worker`
- `outbox-dispatcher`

Interpretação:

- todos `Up`: ambiente operacional.
- `api` parado: portal não consegue gravar online.
- `worker` parado: lançamentos continuam funcionando, mas saldo pode atrasar.
- `outbox-dispatcher` parado: eventos ficam em `outbox_events`.
- `postgres` parado: API não consegue persistir.
- `rabbitmq` parado: Outbox pode acumular pendências.

## 3. Ver Métricas da Aplicação

```bash
curl http://localhost:8000/metrics
```

Métricas principais:

```text
cashflow_http_requests_total
cashflow_http_request_duration_ms_sum
cashflow_transactions_created_total
cashflow_outbox_events_total
cashflow_worker_messages_total
cashflow_consolidation_events_total
```

Como interpretar:

| Métrica | O que indica |
| --- | --- |
| `cashflow_http_requests_total{status="201"}` | Transações criadas com sucesso. |
| `cashflow_http_requests_total{status="401"}` | Chamadas sem API Key válida. |
| `cashflow_http_requests_total{status="422"}` | Payload inválido. |
| `cashflow_http_requests_total{status="500"}` | Erro interno que deve ser investigado. |
| `cashflow_transactions_created_total` | Volume de créditos e débitos criados. |
| `cashflow_outbox_events_total{status="published"}` | Eventos publicados no RabbitMQ. |
| `cashflow_outbox_events_total{status="failed"}` | Falha de publicação no RabbitMQ. |
| `cashflow_worker_messages_total{status="success"}` | Mensagens processadas pelo worker. |
| `cashflow_worker_messages_total{status="failed"}` | Falhas no processamento assíncrono. |
| `cashflow_consolidation_events_total{status="duplicate"}` | Eventos reentregues e ignorados por idempotência. |

## 4. Ver Logs em Tempo Real

Todos os serviços:

```bash
docker compose logs -f
```

Apenas componentes críticos:

```bash
docker compose logs -f api outbox-dispatcher worker
```

Os logs são estruturados em JSON. Campos importantes:

| Campo | Uso |
| --- | --- |
| `timestamp` | Quando aconteceu. |
| `component` | Onde aconteceu: API, transactions, outbox, worker ou consolidation. |
| `event` | Tipo do evento logado. |
| `correlation_id` | ID para rastrear a operação ponta a ponta. |
| `transaction_id` | ID do lançamento financeiro. |
| `event_id` | ID do evento assíncrono. |
| `status` | Resultado do processamento. |
| `error_type` | Tipo do erro. |
| `error_message` | Mensagem do erro. |

## 5. Investigar Uma Movimentação Ponta a Ponta

Crie uma movimentação com um `X-Correlation-ID` conhecido:

```bash
CORRELATION_ID="debug-$(date +%s)"

curl -i -X POST http://localhost:8000/transactions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: local-dev-key" \
  -H "X-Correlation-ID: $CORRELATION_ID" \
  -d '{
    "merchant_id": "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
    "type": "CREDIT",
    "amount": "100.00",
    "description": "Venda rastreavel",
    "occurred_at": "2026-05-20T10:00:00"
  }'
```

A resposta deve devolver o mesmo header:

```text
X-Correlation-ID: debug-...
```

Agora procure esse ID nos logs:

```bash
docker compose logs api outbox-dispatcher worker | grep "$CORRELATION_ID"
```

Fluxo esperado nos logs:

1. `http_request_completed` na API.
2. `transaction_created` no módulo de lançamentos.
3. `outbox_event_published` no Outbox Dispatcher.
4. `transaction_consolidated` na consolidação.
5. `worker_message_ack` no worker.

Se algum passo não aparecer, a investigação começa no componente anterior.

## 6. Verificar Banco de Dados

Últimos lançamentos:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT id, merchant_id, type, amount, created_at FROM transactions ORDER BY created_at DESC LIMIT 5;"
```

Estado do Outbox:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT status, count(*) FROM outbox_events GROUP BY status ORDER BY status;"
```

Últimos eventos do Outbox:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT id, status, attempts, last_error, created_at, published_at FROM outbox_events ORDER BY created_at DESC LIMIT 5;"
```

Eventos processados:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT event_id, transaction_id, processed_at FROM processed_events ORDER BY processed_at DESC LIMIT 5;"
```

Saldos consolidados:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT merchant_id, balance_date, total_credit, total_debit, balance, updated_at FROM daily_balances ORDER BY updated_at DESC LIMIT 5;"
```

Interpretação:

- `transactions` tem linha, mas `outbox_events` não tem evento: problema na criação transacional.
- `outbox_events` está `PENDING`: dispatcher não publicou ainda.
- `outbox_events` está `FAILED`: verificar `last_error`.
- `processed_events` tem evento: worker já processou ou identificou duplicidade.
- `daily_balances` não atualizou: investigar worker/consolidação.

## 7. Verificar RabbitMQ

Fila:

```bash
docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
```

Interpretação:

- `messages = 0`: fila drenada.
- `messages` crescendo: worker não está consumindo rápido o suficiente ou está parado.
- `messages_unacknowledged` crescendo: worker recebeu mensagens, mas não confirmou ACK.

Painel visual:

```text
http://localhost:15672
usuario: guest
senha: guest
```

Fila esperada:

```text
transaction.created
```

## 8. Cenários Comuns de Problema

### API Fora do Ar

Sintomas:

- portal não consegue enviar online;
- `/health` falha;
- `docker compose ps` mostra `api` parada.

Comandos:

```bash
docker compose ps api
docker compose logs api
```

Correção local:

```bash
docker compose up -d api
```

### Worker Parado

Sintomas:

- `POST /transactions` segue retornando `201`;
- saldo consolidado não atualiza;
- fila RabbitMQ acumula mensagens.

Comandos:

```bash
docker compose ps worker
docker compose logs worker
docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
```

Correção local:

```bash
docker compose start worker
```

### Outbox Acumulando

Sintomas:

- transação é criada;
- evento fica `PENDING` ou `FAILED`;
- RabbitMQ não recebe mensagem.

Comandos:

```bash
docker compose logs outbox-dispatcher
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT status, count(*) FROM outbox_events GROUP BY status;"
```

Correção local:

```bash
docker compose restart outbox-dispatcher
```

### RabbitMQ Indisponível

Sintomas:

- dispatcher registra erro de publicação;
- `outbox_events` acumula `PENDING` ou `FAILED`;
- painel `15672` não abre.

Comandos:

```bash
docker compose ps rabbitmq
docker compose logs rabbitmq
```

Correção local:

```bash
docker compose restart rabbitmq outbox-dispatcher worker
```

### Portal Com Pendências Offline

Sintomas:

- portal mostra movimentações aguardando envio;
- API ou Docker ficou indisponível;
- as movimentações ainda não aparecem no banco.

Verifique:

```bash
curl http://localhost:8000/health
docker compose ps
```

Interpretação:

- Se API voltou, o portal deve tentar sincronizar automaticamente.
- Se Docker não voltou, as pendências permanecem no navegador.
- Se houver erro `401`, a pendência não deve ser reenfileirada: é problema de autenticação/configuração.

## 9. Checklist Rápido de Diagnóstico

Quando alguém disser "o sistema deu problema", rode nesta ordem:

```bash
curl http://localhost:8000/health
docker compose ps
curl http://localhost:8000/metrics
docker compose logs --tail=100 api outbox-dispatcher worker
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT status, count(*) FROM outbox_events GROUP BY status;"
docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
```

Com esses comandos você descobre se o problema está:

- na API;
- no banco;
- no Outbox;
- no RabbitMQ;
- no worker;
- na consolidação;
- no portal offline.

## 10. Como Isso Evolui Para Produção

Na execução local, as métricas ficam em memória por processo e os logs saem em `stdout`.

Para produção, a recomendação é:

- Prometheus coletando `/metrics`;
- Grafana para dashboards;
- Loki, OpenSearch, Datadog ou Cloud Logging para centralizar logs;
- alertas para API fora do ar;
- alertas para fila RabbitMQ acumulada;
- alertas para Outbox `FAILED`;
- alertas para worker parado;
- alerta para atraso de consolidação;
- retenção de logs definida por política;
- `correlation_id` preservado em todos os componentes.

## Resumo

A observabilidade atual permite avaliar disponibilidade, volume de requisições, criação de lançamentos, publicação de eventos, processamento do worker, idempotência, fila RabbitMQ, Outbox e atualização do consolidado.

O ponto principal para investigação é o `X-Correlation-ID`: com ele, uma movimentação pode ser rastreada desde a entrada na API até a consolidação final.
