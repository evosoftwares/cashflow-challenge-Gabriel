# Prontidao de Entrega Local

Este documento consolida os ajustes finais para entrega do desafio como uma solucao pronta para avaliacao tecnica local.

## Escopo desta entrega

A entrega oficial e executavel localmente via Docker Compose. Ela sobe API, portal operacional, PostgreSQL, RabbitMQ, worker de consolidacao, Outbox Dispatcher e migration Alembic.

Hospedagem externa nao faz parte do caminho oficial desta entrega. O foco e permitir que o avaliador rode, teste e audite tudo localmente com um unico `docker compose up --build`.

Para facilitar o uso por avaliadores, a raiz do repositorio contem:

- `INSTALL.md` com o passo a passo para baixar por Git ou ZIP.
- `start.bat` para Windows com chamada PowerShell simplificada.
- `start.ps1` para Windows PowerShell.
- `start.sh` para macOS/Linux.

## Itens implementados

- API FastAPI com healthcheck.
- Portal operacional React para registrar e consultar movimentacoes.
- PostgreSQL com schema versionado por Alembic.
- RabbitMQ com fila duravel `transaction.created`.
- Worker assincrono de consolidacao.
- Outbox Dispatcher para publicacao confiavel de eventos.
- Idempotencia via `processed_events`.
- Upsert atomico em `daily_balances`.
- Protecao simples por API Key.
- CORS configurado para o portal local.
- Logs estruturados em JSON.
- Endpoint `/metrics` com contadores locais.
- Testes unitarios, integracao, Docker E2E, carga e overload.
- CI no GitHub Actions para backend, frontend e validacao do Docker Compose.
- Portal com fila offline em IndexedDB e app shell cacheavel em build de front-end.
- Guia de instalacao e atalhos locais para Windows, macOS e Linux.

## Checklist operacional

Antes de entregar ou publicar uma versao final:

```bash
git status --short
PATH=.venv/bin:$PATH pytest
npm --prefix frontend test
npm --prefix frontend run build
docker compose config --quiet
make docker-e2e
make load-test
```

## Evolucao para producao real

Para transformar esta entrega local em operacao produtiva, os proximos passos seriam:

- Trocar credenciais locais por secrets gerenciados.
- Usar HTTPS obrigatorio.
- Substituir API Key simples por JWT/OAuth2 ou autenticacao corporativa.
- Configurar rate limiting.
- Usar PostgreSQL gerenciado com backup, replica e politica de retencao.
- Usar RabbitMQ gerenciado ou cluster com alta disponibilidade.
- Coletar `/metrics` com Prometheus ou agente equivalente.
- Centralizar logs em Loki, OpenSearch, Datadog ou Cloud Logging.
- Configurar alertas para fila acumulada, falha de worker e atraso de consolidacao.
- Adicionar Dead Letter Queue e retry exponencial com limite.
- Definir runbook de incidente para atraso no consolidado.

## Criterio arquitetural

A solucao esta pronta para o desafio porque entrega o fluxo critico com simplicidade operacional, desacoplamento assincrono, consistencia transacional, idempotencia, observabilidade basica e documentacao rastreavel.

Ela nao promete hiperescala prematura. O plano de crescimento esta documentado em `docs/scalability.md` e prioriza evolucoes por evidencia operacional.
