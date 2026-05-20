# Requisitos

## Requisitos funcionais

RF01 - Registrar lançamento financeiro de crédito.

RF02 - Registrar lançamento financeiro de débito.

RF03 - Listar lançamentos financeiros.

RF04 - Consultar saldo consolidado diário.

RF05 - Atualizar saldo diário a partir dos lançamentos registrados.

## Requisitos não funcionais

RNF01 - O controle de lançamentos deve continuar funcionando mesmo se a consolidação estiver indisponível.

RNF02 - O consolidado diário deve suportar 50 requisições por segundo.

RNF03 - A perda máxima em pico deve ser de até 5%.

RNF04 - A solução deve possuir logs básicos.

RNF05 - A solução deve possuir healthcheck.

RNF06 - A solução deve evitar duplicidade no processamento de eventos.

RNF07 - A solução deve ter execução local via Docker Compose.

## Critério sênior

A solução prioriza simplicidade operacional, separação de responsabilidades e desacoplamento assíncrono, evitando complexidade desnecessária para o tamanho do domínio.

## Aderência

O requisito de disponibilidade do controle de lançamentos é atendido ao salvar a transação no PostgreSQL e publicar uma mensagem durável no RabbitMQ. A consolidação acontece em um worker separado, portanto a parada do worker não impede o endpoint `POST /transactions`.

O requisito de 50 requisições por segundo para consulta do consolidado é coberto por um script k6 em `tests/load/daily_balance_50rps.js`, com threshold `http_req_failed < 5%`.
