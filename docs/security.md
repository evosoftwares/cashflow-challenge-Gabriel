# Segurança

## Implementado

- Proteção por API Key.
- Header obrigatório: `X-API-Key: local-dev-key`.
- Validação de payload com Pydantic.
- Variáveis sensíveis via `.env`.
- Credenciais fora do código-fonte.

## Escopo do desafio

Para o escopo do desafio, foi usada API Key simples para proteger o consumo dos endpoints.

Endpoints protegidos:

- `POST /transactions`
- `GET /transactions`
- `GET /daily-balances/{date}`

O endpoint `GET /health` é público para facilitar healthcheck local e de infraestrutura.

## Recomendado para produção

- HTTPS obrigatório.
- JWT/OAuth2.
- Rate limiting.
- Rotação de credenciais.
- Segregação por merchant.
- Criptografia de dados sensíveis.
- Política de acesso ao RabbitMQ.
- Política de acesso ao banco.
