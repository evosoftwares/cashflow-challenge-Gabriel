# Domínios e Capacidades

## Domínio de Lançamentos

Responsável por:

- Registrar crédito.
- Registrar débito.
- Validar valor.
- Persistir lançamento.
- Publicar evento de lançamento criado.

## Domínio de Consolidação

Responsável por:

- Consumir evento de lançamento.
- Calcular saldo diário.
- Manter tabela consolidada.
- Expor consulta de saldo diário.
- Evitar processamento duplicado.

## Capacidades de negócio

- Controle de fluxo de caixa.
- Registro de movimentações financeiras.
- Consolidação diária.
- Consulta de saldo.

## Fronteiras

O domínio de Lançamentos não calcula saldo diário. Ele registra a movimentação e publica o evento `TRANSACTION_CREATED`.

O domínio de Consolidação não cria lançamentos. Ele consome eventos e mantém a visão agregada em `daily_balances`.
