# Guia de Instalacao e Uso Local

Este guia mostra como um avaliador ou usuario tecnico pode instalar, subir e usar o sistema completo localmente.

## Pre-requisitos

- Git.
- Docker com Docker Compose.

Nao e necessario instalar Python, Node.js, PostgreSQL ou RabbitMQ na maquina do avaliador para usar o sistema pelo caminho oficial. Esses componentes sobem pelos containers do Docker Compose.

## Instalacao

```bash
git clone https://github.com/evosoftwares/cashflow-challenge-Gabriel.git
cd cashflow-challenge-Gabriel
cp .env.example .env
docker compose up --build
```

Na primeira execucao, o Docker baixa as imagens, instala dependencias, executa as migrations Alembic e sobe todos os servicos.

## URLs de acesso

| Recurso | URL |
| --- | --- |
| Portal operacional | `http://localhost:5173` |
| API | `http://localhost:8000` |
| Swagger/OpenAPI | `http://localhost:8000/docs` |
| RabbitMQ Management | `http://localhost:15672` |

Credenciais locais do RabbitMQ:

```text
usuario: guest
senha: guest
```

## Como usar pelo portal

1. Abra `http://localhost:5173`.
2. Use o merchant de demonstracao ja preenchido ou gere um novo identificador no portal.
3. Escolha a data de operacao.
4. Registre uma entrada ou saida informando tipo, valor, descricao e data/hora.
5. Confira a movimentacao na tabela do dia.
6. Acompanhe o resumo diario em tempo real no painel de consolidado.

O portal usa a API Key local configurada no Docker Compose e nao exige que o operador digite credenciais tecnicas.

## Como validar pela API

Healthcheck:

```bash
curl http://localhost:8000/health
```

Criar uma movimentacao:

```bash
curl -X POST http://localhost:8000/transactions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: local-dev-key" \
  -d '{
    "merchant_id": "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
    "type": "CREDIT",
    "amount": 100.00,
    "description": "Venda no cartao",
    "occurred_at": "2026-05-20T10:00:00"
  }'
```

Listar movimentacoes:

```bash
curl -H "X-API-Key: local-dev-key" \
  "http://localhost:8000/transactions?merchant_id=8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11&date=2026-05-20"
```

Consultar consolidado:

```bash
curl -H "X-API-Key: local-dev-key" \
  "http://localhost:8000/daily-balances/2026-05-20?merchant_id=8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11"
```

## Como parar

```bash
docker compose down
```

Para remover tambem os volumes de dados locais:

```bash
docker compose down -v
```

## Solucao de problemas

Se alguma porta estiver ocupada, pare o processo que estiver usando:

- `5173`: portal React.
- `8000`: API FastAPI.
- `5432`: PostgreSQL.
- `5672` e `15672`: RabbitMQ.

Se quiser recomecar do zero:

```bash
docker compose down -v
docker compose up --build
```

