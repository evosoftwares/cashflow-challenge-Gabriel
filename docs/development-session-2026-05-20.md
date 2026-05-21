# Historico da Sessao de Desenvolvimento - 2026-05-20

Este documento registra, para manutencao futura, o que foi construido e decidido durante a sessao principal de entrega do desafio de arquitetura de fluxo de caixa.

## Objetivo da Sessao

Entregar uma solucao simples, proporcional e bem justificada para o desafio, cobrindo:

- controle de lancamentos financeiros;
- consolidado diario;
- desacoplamento entre lancamento e consolidacao;
- documentacao arquitetural;
- testes e evidencias;
- portal operacional para demonstracao;
- observabilidade, seguranca, resiliencia e prontidao para entrega.

## Escopo Final Entregue

### Backend e Arquitetura

- Aplicacao FastAPI organizada como monolito modular.
- Modulos principais:
  - `src/transactions/`;
  - `src/consolidation/`;
  - `src/messaging/`;
  - `src/database/`;
  - `src/app/`.
- PostgreSQL como banco principal.
- RabbitMQ como mensageria duravel.
- Worker assincrono para consolidacao diaria.
- Outbox Pattern para evitar perda de evento entre salvar transacao e publicar mensagem.
- Upsert atomico em `daily_balances` para reduzir risco de concorrencia no consolidado.
- Idempotencia do worker via `processed_events`.
- Idempotencia do portal/API via `client_request_id`.
- Alembic como fonte oficial de versionamento do schema.

### Endpoints Implementados

- `GET /health`
- `GET /metrics`
- `POST /transactions`
- `GET /transactions`
- `GET /daily-balances/{date}`
- `GET /daily-balances/{date}/stream`

### Banco de Dados

Tabelas principais:

- `transactions`
- `daily_balances`
- `processed_events`
- `outbox_events`

Evolucao importante da sessao:

- `transactions.client_request_id` foi adicionado na migration `202605200002`.
- `client_request_id` possui restricao unica para impedir duplicidade em reenvios offline.

### Portal Operacional

Foi criado um front-end em React + Vite + TypeScript em `frontend/`, dentro do mesmo repositorio.

O portal cobre a jornada operacional:

- selecionar data;
- registrar entrada e saida;
- listar movimentacoes do dia;
- consultar resumo diario consolidado;
- atualizar resumo em tempo real;
- buscar, ordenar e paginar movimentacoes;
- operar com fila offline quando a API ou rede cair.

Refinamentos relevantes de UX:

- linguagem voltada para operador nao tecnico;
- remocao de informacoes tecnicas visiveis, como chave de acesso;
- substituicao da marca para `Mercado do Bairro`;
- compactacao de numeros, campos e textos;
- hierarquia visual mais clara;
- tabela responsiva;
- remocao de botoes manuais de atualizacao onde havia realtime;
- icones de status online/offline/sincronizando/falha.

### Fluxo Online/Offline

O portal agora funciona em modo offline quando a tela ja esta carregada:

1. operador salva movimentacao;
2. se a API/rede estiver indisponivel, o item vai para IndexedDB;
3. a tabela mostra o item com selo de pendencia;
4. quando o navegador volta online, a fila sincroniza automaticamente;
5. a API usa `client_request_id` para impedir duplicidade;
6. o saldo consolidado so considera dados aceitos pelo backend.

Limite documentado:

- nao foi implementado PWA completo com service worker;
- abrir ou recarregar o portal sem rede continua sendo evolucao futura.

## Documentacao Criada ou Reforcada

- `README.md`
- `docs/requirements.md`
- `docs/domains.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/observability.md`
- `docs/costs.md`
- `docs/transition-architecture.md`
- `docs/scalability.md`
- `docs/overload-tests.md`
- `docs/production-readiness.md`
- `docs/compliance-checklist.md`
- `docs/verification.md`
- `docs/offline-mode.md`
- `docs/adr/adr-001-modular-architecture.md`
- `docs/adr/adr-002-rabbitmq.md`
- `docs/adr/adr-003-postgresql.md`
- `docs/adr/adr-004-idempotency.md`
- `docs/adr/adr-005-outbox-and-atomic-upsert.md`

## Decisoes Arquiteturais

### Mantido simples por design

Foi mantida uma arquitetura de monolito modular, pois o dominio do desafio e pequeno e composto principalmente por lancamentos e consolidacao diaria.

### RabbitMQ em vez de Kafka

RabbitMQ atende ao requisito central de desacoplamento com menor complexidade operacional para o volume declarado.

### Docker Compose como caminho oficial

O caminho oficial de avaliacao e execucao local ficou em Docker Compose com:

- `api`;
- `frontend`;
- `worker`;
- `outbox-dispatcher`;
- `migrate`;
- `postgres`;
- `rabbitmq`.

### Supabase

Supabase nao foi tratado como requisito obrigatorio do avaliador. A decisao documentada foi usar PostgreSQL local via Docker Compose como caminho oficial, deixando Supabase apenas como possivel PostgreSQL gerenciado futuro.

### Evolucoes futuras documentadas

- Dead Letter Queue;
- retry exponencial;
- Prometheus/Grafana;
- cache/read replicas;
- particionamento;
- PWA/service worker;
- JWT/OAuth2;
- rate limiting;
- extracao futura de servicos se o dominio crescer.

## Testes e Validacoes

Testes automatizados e artefatos de validacao:

- testes unitarios;
- testes de integracao;
- testes de contrato do projeto;
- testes de front-end com Vitest + Testing Library;
- teste de carga k6 de 50 req/s;
- testes de overload;
- Docker E2E com PostgreSQL, RabbitMQ, Outbox Dispatcher e worker;
- validacao no navegador local do portal.

Estado de verificacao registrado no fim da sessao:

- `pytest -q`: 25 testes passando;
- `npm --prefix frontend test`: 17 testes passando;
- `npm --prefix frontend run build`: build passando;
- `docker compose config --quiet`: passando;
- `make docker-e2e`: passando;
- GitHub Actions CI: passando no run `26194062237`;
- ultimo commit da sessao antes deste documento: `0e05694`.

## Mapa de Commits da Sessao

| Commit | Descricao |
| --- | --- |
| `9189b03` | Implementacao inicial da solucao do desafio. |
| `a40a5ea` | Alembic migrations e evidencias de verificacao. |
| `074a06a` | Diagramas Mermaid de arquitetura. |
| `887b069` | Fluxo final de compliance e verificacao. |
| `09ef9ec` | Plano de escalabilidade. |
| `94100c8` | Priorizacao de upsert atomico e Outbox. |
| `f350353` | Hardening de SQL, consolidacao e publicacao de eventos. |
| `8d0fe97` | Documentacao dos cenarios de overload. |
| `14c2062` | TDD no cleanup do overload worker. |
| `64076e5` | Portal operacional React. |
| `1efa657` | Melhoria de UX do portal. |
| `1c899f3` | Modernizacao de tokens de design. |
| `62bab32` | Primeira adaptacao visual para identidade de varejo. |
| `02e5230` | Compactacao de escala visual do portal. |
| `c45a0de` | Realtime do resumo diario via SSE. |
| `d763ddb` | Conexao das movimentacoes do dia ao realtime. |
| `20e3773` | Hierarquia visual do portal. |
| `16f3b55` | Status de conexao mais coerente. |
| `503ef78` | Observabilidade estruturada e metrificada. |
| `4801af3` | Desbloqueio do botao de salvar movimentacao. |
| `9ea0099` | Renomeacao da marca para Mercado do Bairro. |
| `77e0d75` | Remocao do badge tecnico de API no topo. |
| `5c82ee9` | Filtro por data na tabela. |
| `cee983a` | Artefatos de prontidao para producao. |
| `48574f7` | Ajuste do CI para Node 24. |
| `895924d` | Atualizacao de actions do CI. |
| `6d81366` | Ordenacao, busca e paginacao da tabela. |
| `ce91e27` | Remocao de atualizacao manual em fluxo realtime. |
| `dc8aa67` | Responsividade da tabela. |
| `bdfbf68` | Fila offline IndexedDB e idempotencia por `client_request_id`. |
| `b1064f2` | Estabilizacao dos testes offline do portal. |
| `0e05694` | Icones de status online/offline/sincronizando/falha. |

## Arquivos Mais Importantes Para Novos Desenvolvedores

- `README.md`: entrada principal da solucao.
- `docs/compliance-checklist.md`: rastreabilidade contra o desafio.
- `docs/architecture.md`: arquitetura alvo e diagramas.
- `docs/offline-mode.md`: limites e funcionamento da fila offline.
- `docs/verification.md`: evidencias de verificacao.
- `src/transactions/service.py`: criacao de transacao e outbox.
- `src/consolidation/service.py`: consolidacao e idempotencia.
- `src/consolidation/repository.py`: upsert atomico do saldo diario.
- `src/messaging/outbox_dispatcher.py`: publicacao confiavel para RabbitMQ.
- `frontend/src/App.tsx`: orquestracao do portal operacional.
- `frontend/src/offlineQueue.ts`: fila local IndexedDB.
- `frontend/src/components/TransactionsTable.tsx`: tabela com busca, ordenacao e paginacao.

## Regras de Manutencao

- Nao remover Alembic como fonte oficial do schema.
- Nao substituir `NUMERIC`/`Decimal` por `float` em valores monetarios.
- Nao acoplar `POST /transactions` diretamente a consolidacao sincrona.
- Preservar Outbox + RabbitMQ + worker para manter resiliencia.
- Manter o portal com linguagem operacional, sem expor detalhes tecnicos ao operador.
- Qualquer mudanca no fluxo offline deve preservar `client_request_id` idempotente.
- Atualizar `docs/verification.md` sempre que a contagem de testes mudar.
