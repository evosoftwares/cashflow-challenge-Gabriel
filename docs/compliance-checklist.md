# Checklist de Aderencia ao Desafio

Este checklist mapeia cada requisito do avaliador para evidencia objetiva no repositorio.

| Requisito do avaliador | Status | Evidencia no repositorio |
| --- | --- | --- |
| Servico de controle de lancamentos | Atendido | `POST /transactions`, `GET /transactions`, `src/transactions/` |
| Servico do consolidado diario | Atendido | `GET /daily-balances/{date}`, `src/consolidation/`, `src/consolidation/worker.py` |
| Mapeamento de dominios funcionais | Atendido | `docs/domains.md` |
| Capacidades de negocio | Atendido | `docs/domains.md`, `docs/architecture.md` |
| Requisitos funcionais e nao funcionais | Atendido | `docs/requirements.md` |
| Arquitetura alvo completa | Atendido | `docs/architecture.md` com diagramas Mermaid |
| Justificativa tecnologica | Atendido | `docs/adr/` |
| Linguagem livre | Atendido | Python e FastAPI |
| Testes | Atendido | `tests/unit/`, `tests/integration/`, `tests/load/` |
| README com funcionamento e execucao local | Atendido | `README.md` |
| Repositorio publico GitHub | Atendido | `https://github.com/evosoftwares/cashflow-challenge-Gabriel` |
| Documentacao versionada no repositorio | Atendido | `docs/` |
| Controle de lancamento nao indisponivel se consolidado cair | Atendido | RabbitMQ duravel, worker separado, `tests/integration/docker_e2e.sh` |
| Consolidado com 50 requisicoes por segundo | Atendido | `tests/load/daily_balance_50rps.js`, `docs/verification.md` |
| Perda maxima de 5% em pico | Atendido | Threshold k6 `http_req_failed < 5%` |
| Arquitetura de transicao, se necessaria | Atendido | `docs/transition-architecture.md` |
| Estimativa de custos | Atendido | `docs/costs.md` |
| Escalabilidade e plano de crescimento | Atendido | `docs/scalability.md`, `README.md` |
| Monitoramento e observabilidade | Atendido | `/health`, logs basicos, `docs/observability.md` |
| Criterios de seguranca para integracao | Atendido | API Key, validacao de payload, `docs/security.md` |

## Decisoes que evitam overengineering

- Nao foi adotado Kubernetes, Service Mesh, CQRS completo ou Event Sourcing completo.
- RabbitMQ foi escolhido por atender ao desacoplamento entre lancamento e consolidacao com menor complexidade que Kafka para o volume informado.
- O banco oficial da execucao local e PostgreSQL via Docker Compose.
- Supabase nao e requisito do avaliador. Pode ser usado futuramente como PostgreSQL gerenciado, mas nao faz parte da entrega obrigatoria.

## Evidencias finais recomendadas

Antes de entregar, executar:

```bash
pytest
make docker-e2e
make load-test
```
