# Observabilidade

## Implementado

- Endpoint `/health`.
- Endpoint `/metrics` em formato texto compatível com Prometheus.
- Logs estruturados em JSON com contrato metrificado.
- Correlação ponta a ponta com header `X-Correlation-ID`.
- Logs de criação de lançamento com contador por tipo.
- Logs de publicação do Outbox com contador por status.
- Logs de processamento do consolidado com contador por status.
- Logs de ACK, falha e mensagem inválida no worker.
- Contador de requisições HTTP por método, rota e status.
- Soma de duração de requisições HTTP em milissegundos.

## Contrato dos logs

Cada evento relevante é registrado em JSON com os campos mínimos:

```json
{
  "timestamp": "2026-05-20T10:00:00.000Z",
  "log_schema_version": "1.0",
  "event": "transaction_created",
  "component": "transactions",
  "correlation_id": "8c0a1e6d-19cb-4c84-8548-ec0570d95d2b",
  "metric": {
    "name": "cashflow_transactions_created_total",
    "value": 1,
    "labels": {
      "type": "CREDIT"
    }
  }
}
```

Campos adicionais, como `transaction_id`, `merchant_id`, `event_id`, `status`, `duration_ms` e `error_type`, são adicionados conforme o contexto.

Essa padronização permite que os logs sejam consumidos por uma ferramenta centralizada no futuro sem mudar o contrato de emissão da aplicação.

## Correlação de Requisições

A API aceita o header:

```text
X-Correlation-ID: 8c0a1e6d-19cb-4c84-8548-ec0570d95d2b
```

Se o cliente não enviar esse header, a API gera um UUID automaticamente. Em todos os casos, o valor é devolvido na resposta:

```text
X-Correlation-ID: 8c0a1e6d-19cb-4c84-8548-ec0570d95d2b
```

Esse identificador é propagado para:

- log HTTP da API;
- log de criação do lançamento;
- payload do evento em `outbox_events`;
- publicação no RabbitMQ;
- logs do Outbox Dispatcher;
- logs do worker de consolidação;
- logs de consolidação bem-sucedida, duplicada ou com falha.

Com isso, uma movimentação pode ser investigada ponta a ponta procurando o mesmo `correlation_id` nos logs da API, dispatcher, fila e worker.

## Métricas expostas

O endpoint `GET /metrics` expõe contadores locais do processo:

| Métrica | Labels | Finalidade |
| --- | --- | --- |
| `cashflow_http_requests_total` | `method`, `path`, `status` | Quantidade de chamadas HTTP por rota e status. |
| `cashflow_http_request_duration_ms_sum` | `method`, `path`, `status` | Soma da duração das chamadas HTTP em milissegundos. |
| `cashflow_transactions_created_total` | `type` | Quantidade de lançamentos criados por crédito ou débito. |
| `cashflow_consolidation_events_total` | `status` | Quantidade de eventos consolidados ou duplicados. |
| `cashflow_outbox_events_total` | `status` | Quantidade de eventos publicados ou com falha no Outbox. |
| `cashflow_worker_messages_total` | `status` | Quantidade de mensagens processadas, duplicadas, inválidas ou com falha no worker. |

Exemplo:

```text
cashflow_transactions_created_total{type="CREDIT"} 10
cashflow_http_requests_total{method="POST",path="/transactions",status="201"} 10
cashflow_consolidation_events_total{status="success"} 10
```

## Eventos logados

```json
{
  "timestamp": "2026-05-20T10:00:00.000Z",
  "log_schema_version": "1.0",
  "event": "transaction_created",
  "component": "transactions",
  "correlation_id": "8c0a1e6d-19cb-4c84-8548-ec0570d95d2b",
  "metric": {
    "name": "cashflow_transactions_created_total",
    "value": 1,
    "labels": {
      "type": "CREDIT"
    }
  },
  "transaction_id": "4dc7300e-8df7-4634-b6a0-8bda7afc4218",
  "merchant_id": "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
  "transaction_type": "CREDIT",
  "amount": "100.00"
}
```

```json
{
  "timestamp": "2026-05-20T10:00:01.000Z",
  "log_schema_version": "1.0",
  "event": "transaction_consolidated",
  "component": "consolidation",
  "correlation_id": "8c0a1e6d-19cb-4c84-8548-ec0570d95d2b",
  "metric": {
    "name": "cashflow_consolidation_events_total",
    "value": 1,
    "labels": {
      "status": "success"
    }
  },
  "event_id": "6a48d7f1-2af4-4324-a218-3e6a0bc1ac77",
  "transaction_id": "4dc7300e-8df7-4634-b6a0-8bda7afc4218",
  "status": "success"
}
```

## Limite da implementação atual

As métricas são mantidas em memória por processo. Isso é proporcional ao desafio e suficiente para execução local, mas não substitui um coletor centralizado em produção.

Em produção, cada réplica de API, worker e Outbox Dispatcher deve ser coletada por Prometheus ou por um agente equivalente. Logs devem ser enviados para uma ferramenta centralizada, como Loki, OpenSearch, Datadog ou Cloud Logging.

## Runbook de Investigação

Quando uma movimentação não aparecer no consolidado:

1. Pegue o `X-Correlation-ID` retornado pela API ou informado pelo cliente.
2. Busque esse valor nos logs:

```bash
docker compose logs api worker outbox-dispatcher | grep "8c0a1e6d-19cb-4c84-8548-ec0570d95d2b"
```

3. Verifique se o lançamento foi criado:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT id, merchant_id, type, amount, created_at FROM transactions ORDER BY created_at DESC LIMIT 5;"
```

4. Verifique o Outbox:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT id, status, attempts, last_error, created_at, published_at FROM outbox_events ORDER BY created_at DESC LIMIT 5;"
```

5. Verifique a fila RabbitMQ:

```bash
docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
```

Interpretação rápida:

- Se a transação existe e o Outbox está `PENDING`, o problema está no dispatcher ou RabbitMQ.
- Se o Outbox está `PUBLISHED` e a fila cresce, o problema está no worker ou na consolidação.
- Se o worker registra erro com o mesmo `correlation_id`, investigue `error_type` e `error_message`.
- Se o evento aparece como `duplicate`, a idempotência atuou e evitou reprocessamento.

## Métricas recomendadas para produção

- Quantidade de lançamentos criados.
- Quantidade de eventos processados.
- Quantidade de eventos duplicados.
- Quantidade de eventos pendentes em `outbox_events`.
- Falhas de publicação no Outbox Dispatcher.
- Falhas de processamento.
- Tempo médio de consolidação.
- Tamanho da fila RabbitMQ.

## Evolução futura

- Prometheus para coleta das métricas de todas as réplicas.
- Grafana para dashboards.
- Alertas para fila acumulada.
- Monitoramento de falhas de processamento.
- Logs centralizados com retenção configurada.
- Tracing distribuído.
