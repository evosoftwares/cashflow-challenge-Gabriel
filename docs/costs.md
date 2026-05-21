# Estimativa de Custos

A solução usa tecnologias open-source, sem custo de licença:

- Python.
- FastAPI.
- React/Vite.
- PostgreSQL.
- RabbitMQ.
- Docker.

Custos esperados em produção:

- Compute para aplicação.
- Compute para worker.
- Compute para Outbox Dispatcher.
- Hospedagem do front-end estático.
- CDN opcional para distribuição do portal.
- Pipeline de build e deploy.
- Banco PostgreSQL.
- RabbitMQ gerenciado ou self-hosted.
- Armazenamento.
- Backup.
- Logs e monitoramento.
- Domínio e certificado TLS, quando aplicável.

Para o escopo do desafio, a execução local via Docker Compose não possui custo de infraestrutura além da máquina do avaliador.

Não foi incluído preço exato de nuvem porque o enunciado não define provedor, região, SLA, volume de armazenamento, retenção de logs ou política de backup.

## Caminho gratuito recomendado

Para publicar sem custo recorrente sempre que houver capacidade disponível, a opção recomendada é Oracle Cloud Always Free com VM Ampere A1 ARM.

Esse caminho permite rodar a stack completa em Docker Compose na mesma VM:

- Caddy;
- front-end estático;
- API FastAPI;
- PostgreSQL;
- RabbitMQ;
- worker de consolidação;
- Outbox Dispatcher.

Pontos de atenção:

- a disponibilidade de shape Always Free pode variar por região;
- o provedor pode aplicar regras de ociosidade para recursos gratuitos;
- backup externo não deve depender apenas do disco da VM;
- domínio próprio pode ter custo separado, embora o acesso por IP continue possível sem domínio.
