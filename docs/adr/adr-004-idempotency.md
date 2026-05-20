# ADR-004 - Controle de Idempotência na Consolidação

## Decisão

Foi adotada uma tabela `processed_events` para evitar processamento duplicado de eventos.

## Justificativa

Mensagens podem ser reentregues em sistemas baseados em fila.

Sem idempotência, o saldo diário poderia ser atualizado mais de uma vez para o mesmo lançamento.

## Trade-off

A solução adiciona uma tabela de controle, mas aumenta a confiabilidade do consolidado.
