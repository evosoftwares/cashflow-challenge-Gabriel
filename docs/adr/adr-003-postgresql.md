# ADR-003 - Uso de PostgreSQL

## Decisão

Foi adotado PostgreSQL como banco principal.

## Justificativa

O domínio financeiro exige consistência, integridade e suporte transacional.

PostgreSQL atende bem ao escopo do desafio, possui maturidade e é simples de executar localmente via Docker.

## Trade-off

Para cenários de altíssimo volume, poderiam ser avaliadas otimizações ou tecnologias complementares.
