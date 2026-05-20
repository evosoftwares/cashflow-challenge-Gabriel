# Arquitetura

## Visão geral

A solução foi desenhada como uma arquitetura modular orientada a eventos.

O domínio de Lançamentos é responsável por registrar movimentações financeiras.

O domínio de Consolidação é responsável por calcular e disponibilizar o saldo diário.

A comunicação entre os dois ocorre de forma assíncrona via RabbitMQ, garantindo que falhas na consolidação não impactem o registro de lançamentos.

## Diagrama de contexto

```mermaid
flowchart TD
    USER[Comerciante / Operador]
    SYSTEM[Cash Flow System<br/>Controle de Fluxo de Caixa Diário]
    USER -->|Registra créditos e débitos| SYSTEM
    USER -->|Consulta saldo diário consolidado| SYSTEM
    SYSTEM -->|Persiste lançamentos| DB[(PostgreSQL)]
    SYSTEM -->|Publica eventos de lançamento| MQ[RabbitMQ]
    MQ -->|Entrega eventos| WORKER[Worker de Consolidação]
    WORKER -->|Atualiza saldo diário| DB
```

## Arquitetura alvo da solução

```mermaid
flowchart TD
    CLIENT[Cliente / Usuário]
    subgraph APP[FastAPI Application - Monólito Modular]
        API[API Layer]
        subgraph TRANSACTIONS[Módulo de Lançamentos]
            TRoutes[Transactions Routes]
            TService[Transactions Service]
            TRepo[Transactions Repository]
        end
        subgraph CONSOLIDATION[Módulo de Consolidação]
            CRoutes[Daily Balance Routes]
            CService[Consolidation Service]
            CRepo[Consolidation Repository]
        end
        subgraph MESSAGING[Módulo de Mensageria]
            Publisher[Event Publisher]
            Consumer[Event Consumer]
        end
    end
    DB[(PostgreSQL)]
    MQ[RabbitMQ<br/>Queue: transaction.created]
    WORKER[Consolidation Worker]
    CLIENT -->|HTTP Request| API
    API --> TRoutes
    TRoutes --> TService
    TService --> TRepo
    TRepo -->|Salva lançamento| DB
    TService --> Publisher
    Publisher -->|Publica evento| MQ
    MQ -->|Entrega evento| WORKER
    WORKER --> Consumer
    Consumer --> CService
    CService --> CRepo
    CRepo -->|Atualiza saldo diário| DB
    API --> CRoutes
    CRoutes --> CService
    CService -->|Consulta saldo consolidado| DB
```

## Fluxo de criação de lançamento

```mermaid
sequenceDiagram
    actor User as Comerciante
    participant API as FastAPI
    participant Transaction as Módulo de Lançamentos
    participant DB as PostgreSQL
    participant MQ as RabbitMQ
    participant Worker as Worker de Consolidação
    participant Consolidation as Módulo de Consolidação
    User->>API: POST /transactions
    API->>Transaction: Validar dados do lançamento
    Transaction->>DB: Salvar lançamento em transactions
    DB-->>Transaction: Lançamento salvo
    Transaction->>MQ: Publicar evento transaction.created
    MQ-->>Transaction: Evento recebido
    Transaction-->>API: Retornar 201 Created
    API-->>User: Lançamento criado com sucesso
    MQ->>Worker: Entregar evento pendente
    Worker->>Consolidation: Processar evento
    Consolidation->>DB: Verificar processed_events
    Consolidation->>DB: Atualizar daily_balances
    Consolidation->>DB: Registrar event_id processado
    Worker->>MQ: ACK da mensagem
```

Fluxo:

1. Cliente chama `POST /transactions`.
2. API valida os dados.
3. Lançamento é salvo no banco.
4. Evento `transaction.created` é publicado no RabbitMQ.
5. API retorna sucesso.
6. Worker consome o evento.
7. Worker atualiza o saldo diário.

## Fluxo de resiliência

```mermaid
sequenceDiagram
    actor User as Comerciante
    participant API as FastAPI
    participant Transaction as Módulo de Lançamentos
    participant DB as PostgreSQL
    participant MQ as RabbitMQ
    participant Worker as Worker de Consolidação
    Note over Worker: Worker indisponível
    User->>API: POST /transactions
    API->>Transaction: Criar lançamento
    Transaction->>DB: Salvar lançamento
    DB-->>Transaction: Lançamento salvo
    Transaction->>MQ: Publicar evento transaction.created
    MQ-->>Transaction: Mensagem armazenada na fila
    Transaction-->>API: 201 Created
    API-->>User: Lançamento criado com sucesso
    Note over MQ: Evento permanece aguardando consumo
    Note over Worker: Worker volta a ficar disponível
    MQ->>Worker: Entregar evento pendente
    Worker->>DB: Atualizar daily_balances
    Worker->>MQ: ACK da mensagem
```

Se o worker de consolidação estiver indisponível:

1. O lançamento continua sendo salvo.
2. A mensagem fica na fila.
3. Quando o worker volta, a mensagem é processada.

## Diagrama de domínios e capacidades

```mermaid
flowchart LR
    subgraph BUSINESS[Capacidades de Negócio]
        CF[Controle de Fluxo de Caixa]
        REG[Registro de Movimentações]
        CONS[Consolidação Diária]
        QUERY[Consulta de Saldo]
    end
    subgraph DOMAIN1[Domínio de Lançamentos]
        CRED[Registrar Crédito]
        DEB[Registrar Débito]
        VAL[Validar Lançamento]
        EVT[Publicar Evento]
    end
    subgraph DOMAIN2[Domínio de Consolidação]
        CONSUME[Consumir Evento]
        CALC[Calcular Saldo Diário]
        IDEMP[Garantir Idempotência]
        BAL[Disponibilizar Saldo]
    end
    CF --> REG
    CF --> CONS
    CF --> QUERY
    REG --> DOMAIN1
    CONS --> DOMAIN2
    QUERY --> DOMAIN2
    CRED --> EVT
    DEB --> EVT
    VAL --> EVT
    EVT --> CONSUME
    CONSUME --> IDEMP
    IDEMP --> CALC
    CALC --> BAL
```

## Modelo lógico de dados

```mermaid
erDiagram
    TRANSACTIONS {
        uuid id PK
        uuid merchant_id
        string type
        decimal amount
        string description
        datetime occurred_at
        datetime created_at
    }
    DAILY_BALANCES {
        uuid id PK
        uuid merchant_id
        date balance_date
        decimal total_credit
        decimal total_debit
        decimal balance
        datetime updated_at
    }
    PROCESSED_EVENTS {
        uuid event_id PK
        uuid transaction_id
        datetime processed_at
    }
    TRANSACTIONS ||--o| PROCESSED_EVENTS : generates
    TRANSACTIONS }o--|| DAILY_BALANCES : contributes_to
```

## Diagrama de decisão arquitetural

```mermaid
flowchart TD
    REQ[Requisito crítico:<br/>lançamentos não podem parar<br/>se consolidação cair]
    SYNC[Comunicação síncrona<br/>API chama consolidado diretamente]
    ASYNC[Comunicação assíncrona<br/>via RabbitMQ]
    REQ --> CHOICE{Qual abordagem atende melhor?}
    CHOICE --> SYNC
    CHOICE --> ASYNC
    SYNC --> BAD[Não recomendado<br/>falha no consolidado pode afetar lançamento]
    ASYNC --> GOOD[Recomendado<br/>lançamento segue funcionando<br/>evento fica na fila]
    GOOD --> RESULT[Decisão:<br/>usar RabbitMQ com worker assíncrono]
```

## Descrição das tabelas

### transactions

Armazena cada lançamento financeiro individual, com `type` restrito a `CREDIT` ou `DEBIT` e `amount` em `NUMERIC(14, 2)`.

### daily_balances

Armazena a visão consolidada por comerciante e data. A restrição única em `merchant_id` + `balance_date` evita duplicidade de saldo diário.

### processed_events

Armazena os `event_id` já processados pelo worker. Essa tabela garante idempotência quando o RabbitMQ reentrega uma mensagem.

## Migrations

O schema é versionado com Alembic. No Docker Compose, o serviço `migrate` executa `alembic upgrade head` antes da API e do worker.

## Banco remoto

Supabase não foi usado nesta entrega. A arquitetura alvo usa PostgreSQL e a execução local usa o PostgreSQL do Docker Compose. Como evolução operacional, a mesma migration Alembic pode ser aplicada em um PostgreSQL gerenciado, incluindo Supabase, desde que a `DATABASE_URL` remota seja fornecida por variável de ambiente segura.

## Escalabilidade

A arquitetura escala de forma proporcional ao escopo do desafio. A API pode ser replicada horizontalmente, o worker pode ganhar mais instâncias e o RabbitMQ absorve picos temporários mantendo lançamento e consolidação desacoplados.

O principal gargalo esperado em crescimento acelerado é a atualização concorrente de `daily_balances` para o mesmo `merchant_id` e a mesma `balance_date`. O plano de evolução é primeiro escalar componentes e observar métricas, depois adicionar DLQ, retry, Outbox Pattern e alertas, e só então avaliar batch, particionamento, cache, read replicas ou extração para serviços independentes.

O plano completo está em `docs/scalability.md`.

## Trade-offs

A arquitetura modular evita a complexidade operacional de microsserviços para um domínio pequeno, mas mantém fronteiras claras para uma extração futura.

RabbitMQ adiciona um componente operacional, mas resolve o ponto mais importante do desafio: desacoplar lançamento e consolidação.

O projeto não implementa Outbox Pattern completo. Em produção, ele seria a evolução recomendada para garantir publicação de eventos mesmo em falhas entre commit no banco e envio à fila.
