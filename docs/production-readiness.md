# Prontidao de Producao

Este documento consolida os ajustes finais para entrega do desafio como uma solucao pronta para avaliacao tecnica e com caminho claro para producao.

## Escopo desta entrega

A entrega oficial e executavel localmente via Docker Compose. Ela sobe API, portal operacional, PostgreSQL, RabbitMQ, worker de consolidacao, Outbox Dispatcher e migration Alembic.

Tambem foi preparado um caminho de deploy em VPS/VM com Docker Compose, documentado em `docs/cloud-deployment.md`. O alvo recomendado para buscar gratuidade e Oracle Cloud Always Free ARM, mantendo todos os servicos no mesmo host.

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
- Compose de producao para VPS em `docker-compose.prod.yml`.
- Proxy Caddy com roteamento `/api` e HTTPS automatico quando houver dominio.
- Portal em modo PWA com cache do app shell e fila offline em IndexedDB.

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

## Prontidao para producao real

Para transformar esta entrega em operacao produtiva, os proximos passos seriam:

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

## Caminho gratuito

O caminho gratuito recomendado roda em uma unica VM Always Free. Essa opcao e suficiente para demonstracao, avaliacao e operacao pequena, mas nao substitui alta disponibilidade real.

Limites aceitos nesse caminho:

- banco, broker e aplicacao compartilham o mesmo host;
- a VM segue os limites e disponibilidade do provedor gratuito;
- sem dominio, o acesso por IP usa HTTP;
- com dominio apontando para a VM, Caddy pode emitir HTTPS automaticamente;
- backup externo precisa ser configurado para proteger contra perda da VM.

## Criterio arquitetural

A solucao esta pronta para o desafio porque entrega o fluxo critico com simplicidade operacional, desacoplamento assincrono, consistencia transacional, idempotencia, observabilidade basica e documentacao rastreavel.

Ela nao promete hiperescala prematura. O plano de crescimento esta documentado em `docs/scalability.md` e prioriza evolucoes por evidencia operacional.
