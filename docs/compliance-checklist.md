# Checklist de Aderencia ao Desafio

Este checklist mapeia cada requisito do avaliador para evidencia objetiva no repositorio.

| Requisito do avaliador | Status | Evidencia no repositorio |
| --- | --- | --- |
| Servico de controle de lancamentos | Atendido | `POST /transactions`, `GET /transactions`, `src/transactions/` |
| Servico do consolidado diario | Atendido | `GET /daily-balances/{date}`, `src/consolidation/`, `src/consolidation/worker.py` |
| Resumo diario em tempo real no portal | Atendido | `GET /daily-balances/{date}/stream`, `frontend/src/api/client.ts`, `frontend/src/App.tsx` |
| Mapeamento de dominios funcionais | Atendido | `docs/domains.md` |
| Capacidades de negocio | Atendido | `docs/domains.md`, `docs/architecture.md` |
| Requisitos funcionais e nao funcionais | Atendido | `docs/requirements.md` |
| Arquitetura alvo completa | Atendido | `docs/architecture.md` com diagramas Mermaid |
| Justificativa tecnologica | Atendido | `docs/adr/` |
| Linguagem livre | Atendido | Python e FastAPI |
| Testes | Atendido | `tests/unit/`, `tests/integration/`, `tests/load/` |
| README com funcionamento e execucao local | Atendido | `README.md`, `docs/user-guide.md` |
| Repositorio publico GitHub | Atendido | `https://github.com/evosoftwares/cashflow-challenge-Gabriel` |
| Documentacao versionada no repositorio | Atendido | `docs/` |
| Interface operacional para demonstracao | Atendido | `frontend/`, `docker-compose.yml`, `README.md` |
| Registro offline no portal | Atendido | IndexedDB em `frontend/src/offlineQueue.ts`, idempotencia por `client_request_id`, `docs/offline-mode.md` |
| App shell instalavel/cacheavel para reduzir dependencia do dispositivo | Atendido | `frontend/public/manifest.webmanifest`, `frontend/public/sw.js`, `frontend/src/pwa.ts` |
| Controle de lancamento nao indisponivel se consolidado cair | Atendido | RabbitMQ duravel, worker separado, `tests/integration/docker_e2e.sh` |
| Publicacao confiavel de eventos | Atendido | `outbox_events`, `src/messaging/outbox_dispatcher.py` |
| Consolidacao segura sob concorrencia | Atendido | Upsert atomico em `src/consolidation/repository.py` |
| Consolidado com 50 requisicoes por segundo | Atendido | `tests/load/daily_balance_50rps.js`, `docs/verification.md` |
| Perda maxima de 5% em pico | Atendido | Threshold k6 `http_req_failed < 5%` |
| Simulacao de overload | Atendido | `docs/overload-tests.md`, `tests/load/overload_read_300rps.js`, `tests/load/overload_worker_backlog.sh` |
| Arquitetura de transicao, se necessaria | Atendido | `docs/transition-architecture.md` |
| Estimativa de custos | Atendido | `docs/costs.md` |
| Escalabilidade e plano de crescimento | Atendido | `docs/scalability.md`, `README.md` |
| Monitoramento e observabilidade | Atendido | `/health`, `/metrics`, logs JSON metrificados, `docs/observability.md` |
| Criterios de seguranca para integracao | Atendido | API Key, validacao de payload, `docs/security.md` |
| Prontidao final para entrega | Atendido | `docs/production-readiness.md`, `.github/workflows/ci.yml`, `.dockerignore` |

## Decisoes que evitam overengineering

- Nao foi adotado Kubernetes, Service Mesh, CQRS completo ou Event Sourcing completo.
- RabbitMQ foi escolhido por atender ao desacoplamento entre lancamento e consolidacao com menor complexidade que Kafka para o volume informado.
- O banco oficial da execucao local e PostgreSQL via Docker Compose.
- Supabase nao e requisito do avaliador. Pode ser usado futuramente como PostgreSQL gerenciado, mas nao faz parte da entrega obrigatoria.
- Hospedagem externa nao faz parte do caminho oficial. A entrega oficial e executavel localmente por Docker Compose para evitar dependencia de provedor externo.

## Evidencias finais recomendadas

Antes de entregar, executar:

```bash
git status --short
PATH=.venv/bin:$PATH pytest -q
npm --prefix frontend test
npm --prefix frontend run build
docker compose config --quiet
make docker-e2e
make load-test
make overload-read
make overload-worker
```

Tambem validar no banco real:

```bash
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT * FROM alembic_version;"
docker compose exec -T postgres psql -U cashflow -d cashflow -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
docker compose exec -T rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
```
