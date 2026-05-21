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
