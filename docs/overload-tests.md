# Testes de Overload

Este documento registra simulações de carga acima do requisito mínimo do desafio e explica como o sistema reage.

## Objetivo

Validar dois comportamentos:

1. Como o endpoint de consulta do consolidado reage acima de 50 requisições por segundo.
2. Como a arquitetura reage quando há muitos lançamentos e o worker de consolidação está parado.

## Pré-requisito

Subir o ambiente local:

```bash
docker compose up --build
```

Ou executar o E2E antes:

```bash
make docker-e2e
```

## Cenário 1 - Overload de leitura

Script:

```bash
k6 run tests/load/overload_read_300rps.js
```

Carga aplicada:

- endpoint: `GET /daily-balances/2026-05-20`;
- taxa alvo: 300 requisições por segundo;
- duração: 30 segundos;
- VUs: 40 iniciais, 120 máximos.

Resultado observado:

```text
http_reqs......................: 8974   299.091052/s
http_req_failed................: 0.00%  0 out of 8974
checks_succeeded...............: 100.00% 8974 out of 8974
http_req_duration p95..........: 4.44ms
http_req_duration max..........: 303.51ms
dropped_iterations.............: 27
```

Interpretação:

- A API respondeu sem falhas HTTP.
- O endpoint ficou acima do requisito oficial de 50 rps.
- As `dropped_iterations` indicam que o gerador local não conseguiu agendar exatamente todas as iterações planejadas, não que a API tenha retornado erro.

## Cenário 2 - Overload de escrita com worker parado

Script:

```bash
make overload-worker
```

O script executa:

1. Para o worker de consolidação.
2. Gera um `merchant_id` novo para a execução.
3. Confirma que a fila e o Outbox começam sem pendências.
4. Envia 500 lançamentos com concorrência 50.
5. Aguarda o Outbox Dispatcher publicar os eventos no RabbitMQ.
6. Confirma que a fila acumulou mensagens.
7. Religa o worker.
8. Aguarda a drenagem da fila.
9. Confere o saldo consolidado final.

Também é possível sobrescrever os parâmetros:

```bash
COUNT=1000 CONCURRENCY=100 make overload-worker
```

Fluxo validado:

```text
API aceita lançamentos -> Outbox registra eventos -> RabbitMQ acumula backlog -> worker drena fila -> daily_balances fecha o saldo
```

Resultado observado na criação dos lançamentos:

```json
{
  "sent": 500,
  "concurrency": 50,
  "elapsed_seconds": 1.23,
  "approx_rps": 407.11,
  "statuses": {
    "201": 500
  }
}
```

Resultado com worker parado:

```text
pending_outbox=0
transaction.created 500 0
```

Resultado após religar o worker:

```text
queue=0:0
processed=500
balance=500.00
```

Saldo final:

```text
total_credit: 500.00
total_debit: 0.00
balance: 500.00
```

## Comportamento esperado do sistema

Durante overload de escrita com worker parado:

- `POST /transactions` continua retornando `201 Created`.
- Os eventos são registrados em `outbox_events`.
- O Outbox Dispatcher publica os eventos no RabbitMQ.
- A fila `transaction.created` acumula mensagens.
- O consolidado pode ficar atrasado temporariamente.
- Quando o worker volta, ele consome o backlog.
- O saldo é atualizado com upsert atômico.
- `processed_events` evita reprocessamento duplicado.

## Limites e próximos passos

Se a fila crescer continuamente, os próximos passos operacionais são:

- escalar workers;
- escalar Outbox Dispatcher;
- ajustar pool de conexões;
- adicionar DLQ;
- adicionar retry exponencial com limite;
- monitorar tamanho de fila, pendências de Outbox e latência de consolidação;
- avaliar batch de consolidação se houver backlog recorrente.
