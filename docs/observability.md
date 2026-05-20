# Observabilidade

## Implementado

- Endpoint `/health`.
- Logs estruturados básicos.
- Logs de criação de lançamento.
- Logs de processamento do consolidado.
- Logs de erro no worker.

## Exemplos de eventos logados

```json
{
  "event": "transaction_created",
  "transaction_id": "4dc7300e-8df7-4634-b6a0-8bda7afc4218",
  "merchant_id": "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
  "amount": "100.00"
}
```

```json
{
  "event": "transaction_consolidated",
  "event_id": "6a48d7f1-2af4-4324-a218-3e6a0bc1ac77",
  "transaction_id": "4dc7300e-8df7-4634-b6a0-8bda7afc4218",
  "status": "success"
}
```

## Métricas recomendadas para produção

- Quantidade de lançamentos criados.
- Quantidade de eventos processados.
- Quantidade de eventos duplicados.
- Falhas de processamento.
- Tempo médio de consolidação.
- Tamanho da fila RabbitMQ.

## Evolução futura

- Prometheus para métricas.
- Grafana para dashboards.
- Alertas para fila acumulada.
- Monitoramento de falhas de processamento.
- Tracing distribuído.
