# ADR-002 - Uso de RabbitMQ para Comunicação Assíncrona

## Decisão

Foi adotado RabbitMQ para desacoplar o registro de lançamentos da consolidação diária.

## Justificativa

O requisito não funcional determina que o serviço de controle de lançamentos não deve ficar indisponível se o consolidado cair.

RabbitMQ permite que o lançamento seja registrado e que a consolidação aconteça de forma assíncrona.

## Trade-off

A solução passa a depender de um componente adicional de mensageria.

Para o volume informado de 50 requisições por segundo, RabbitMQ é suficiente e mais simples que Kafka.
