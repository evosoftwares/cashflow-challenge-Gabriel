# Arquitetura

## Visão geral

A solução foi desenhada como uma arquitetura modular orientada a eventos.

O domínio de Lançamentos é responsável por registrar movimentações financeiras.

O domínio de Consolidação é responsável por calcular e disponibilizar o saldo diário.

A comunicação entre os dois ocorre de forma assíncrona via RabbitMQ, garantindo que falhas na consolidação não impactem o registro de lançamentos.

## Diagrama

```mermaid
flowchart TD
    A[Cliente] --> B[FastAPI]
    B --> C[Transactions Module]
    C --> D[(PostgreSQL - transactions)]
    C --> E[RabbitMQ - transaction.created]
    E --> F[Consolidation Worker]
    F --> G[(PostgreSQL - daily_balances)]
    B --> H[Consolidation Query]
    H --> G
```

## Fluxo de criação de lançamento

1. Cliente chama `POST /transactions`.
2. API valida os dados.
3. Lançamento é salvo no banco.
4. Evento `transaction.created` é publicado no RabbitMQ.
5. API retorna sucesso.
6. Worker consome o evento.
7. Worker atualiza o saldo diário.

## Fluxo de falha

Se o worker de consolidação estiver indisponível:

1. O lançamento continua sendo salvo.
2. A mensagem fica na fila.
3. Quando o worker volta, a mensagem é processada.

## Modelo de dados

### transactions

Armazena cada lançamento financeiro individual, com `type` restrito a `CREDIT` ou `DEBIT` e `amount` em `NUMERIC(14, 2)`.

### daily_balances

Armazena a visão consolidada por comerciante e data. A restrição única em `merchant_id` + `balance_date` evita duplicidade de saldo diário.

### processed_events

Armazena os `event_id` já processados pelo worker. Essa tabela garante idempotência quando o RabbitMQ reentrega uma mensagem.

## Trade-offs

A arquitetura modular evita a complexidade operacional de microsserviços para um domínio pequeno, mas mantém fronteiras claras para uma extração futura.

RabbitMQ adiciona um componente operacional, mas resolve o ponto mais importante do desafio: desacoplar lançamento e consolidação.

O projeto não implementa Outbox Pattern completo. Em produção, ele seria a evolução recomendada para garantir publicação de eventos mesmo em falhas entre commit no banco e envio à fila.
