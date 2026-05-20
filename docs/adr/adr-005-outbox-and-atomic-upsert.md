# ADR-005 - Outbox e Upsert Atomico na Consolidacao

## Decisão

Foi adotado Outbox Pattern para publicação confiável de eventos e upsert atômico no PostgreSQL para atualização do saldo diário.

## Justificativa

O registro do lançamento e o registro do evento precisam ocorrer de forma consistente. Com Outbox, a transação financeira e o evento pendente são salvos na mesma transação de banco, reduzindo o risco de existir lançamento sem evento publicado.

A consolidação diária atualiza uma linha por `merchant_id` e `balance_date`. Em cenários com mais de um worker, essa linha pode receber atualizações concorrentes. O uso de `INSERT ... ON CONFLICT ... DO UPDATE` delega a soma ao PostgreSQL e reduz o risco de perda de atualização.

## Trade-off

A solução passa a ter uma tabela `outbox_events` e um processo adicional, o Outbox Dispatcher.

Esse custo operacional é menor do que adotar prematuramente Kafka, Kubernetes ou microsserviços independentes, e aumenta a confiabilidade da arquitetura mantendo o desenho simples.

