# Deploy em VPS/VM com Docker Compose

## Decisao recomendada

Para buscar gratuidade mantendo a arquitetura completa, a recomendacao e usar uma VM Oracle Cloud Always Free com arquitetura ARM.

Motivos:

- a oferta Always Free da Oracle inclui Ampere A1 com ate 4 OCPUs e 24 GB de memoria dentro do limite gratuito;
- tambem inclui 200 GB de Block Volume no total da tenancy;
- e suficiente para rodar API, portal, PostgreSQL, RabbitMQ, worker, Outbox Dispatcher e Caddy em uma unica VM;
- preserva o mesmo modelo operacional do Docker Compose local.

Alternativas como AWS, Google Cloud e Azure possuem free tiers uteis para testes, mas normalmente usam VMs menores, creditos temporarios ou limites mais apertados para rodar banco, broker, API, worker e front-end no mesmo host.

Referencias oficiais:

- Oracle Always Free Resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- AWS EC2 Free Tier: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html
- Google Compute Engine Free Tier: https://cloud.google.com/free/docs/compute-getting-started

## O que "nao depender de internet" significa aqui

Cloud depende de internet para acesso remoto. A mitigacao implementada e:

1. A aplicacao roda na cloud.
2. O portal e instalavel/cacheavel como PWA.
3. Se o operador ja abriu o portal antes, a tela pode abrir novamente a partir do cache do navegador.
4. Movimentacoes criadas sem conexao ficam em IndexedDB.
5. Quando a internet volta, o portal sincroniza com a API usando `client_request_id`.

Limite importante: enquanto a internet estiver indisponivel, o backend cloud nao recebe novos dados. O saldo consolidado so passa a refletir esses registros depois da sincronizacao.

## Arquivos de producao

- `docker-compose.prod.yml`: Compose de producao para VPS.
- `.env.production.example`: template de variaveis sem segredos reais.
- `deploy/Caddyfile`: proxy HTTP/HTTPS e roteamento `/api`.
- `frontend/Dockerfile`: build estatico do portal React.
- `frontend/nginx.conf`: entrega do portal em Nginx.
- `frontend/public/manifest.webmanifest`: manifesto PWA.
- `frontend/public/sw.js`: service worker para cache do app shell.
- `scripts/provision-ubuntu-docker.sh`: prepara Ubuntu com Docker e firewall.
- `scripts/deploy-vps.sh`: envia o projeto para a VM e sobe o Compose de producao.

## Requisitos da VM

Recomendado para Oracle Always Free:

- Ubuntu 22.04 ou 24.04.
- Shape Ampere A1 ARM.
- 2 OCPUs e 8 GB de RAM no minimo para folga operacional.
- Boot volume de pelo menos 50 GB.
- Portas liberadas na cloud: `22`, `80`, `443`.

Para uma VM menor, o sistema pode rodar, mas PostgreSQL e RabbitMQ disputarão memoria com API, worker e front-end. Nesse caso, reduzir pool de conexoes e acompanhar uso de memoria.

## Variaveis de producao

Na VM:

```bash
cp .env.production.example .env.production
```

Editar:

```text
APP_DOMAIN=:80
APP_ORIGIN=http://SEU_IP_PUBLICO
ACME_EMAIL=admin@example.com
API_KEY=uma-chave-longa-e-aleatoria
POSTGRES_PASSWORD=senha-longa-sem-caracteres-especiais-de-url
RABBITMQ_DEFAULT_USER=cashflow
RABBITMQ_DEFAULT_PASS=senha-longa-sem-caracteres-especiais-de-url
```

Para usar dominio e HTTPS automatico:

```text
APP_DOMAIN=caixa.seudominio.com
APP_ORIGIN=https://caixa.seudominio.com
ACME_EMAIL=seu-email@seudominio.com
```

O DNS do dominio deve apontar para o IP publico da VM antes de subir o Caddy com HTTPS.

## Provisionamento da VM

Na VM Ubuntu:

```bash
sudo bash scripts/provision-ubuntu-docker.sh
```

Esse script instala Docker, Docker Compose plugin, Git e configura firewall com `22`, `80` e `443`.

## Deploy

### Caminho rapido em qualquer VPS Ubuntu/Debian

Em uma VPS com IP publico, SSH funcionando e portas `80`/`443` liberadas no firewall do provedor:

```bash
curl -fsSL https://raw.githubusercontent.com/evosoftwares/cashflow-challenge-Gabriel/main/scripts/bootstrap-cloud.sh | sudo bash
```

O script:

1. instala Docker e Docker Compose;
2. clona ou atualiza o repositorio em `/opt/cashflow`;
3. gera `.env.production` com senhas aleatorias;
4. configura o acesso por IP publico quando nenhum dominio e informado;
5. sobe `docker-compose.prod.yml`;
6. imprime o link do portal.

Para dominio proprio:

```bash
curl -fsSL https://raw.githubusercontent.com/evosoftwares/cashflow-challenge-Gabriel/main/scripts/bootstrap-cloud.sh | sudo bash -s caixa.seudominio.com
```

Antes de usar dominio, o DNS deve apontar para o IP publico da VM. Com dominio valido, Caddy tenta emitir HTTPS automaticamente.

Limite: o script prepara o servidor, mas nao cria a VM nem a conta no provedor. A VM precisa existir antes.

### Caminho manual

Do computador local:

```bash
scripts/deploy-vps.sh ubuntu@SEU_IP_PUBLICO /opt/cashflow
```

Na primeira execucao, criar `.env.production` na VM antes de subir:

```bash
ssh ubuntu@SEU_IP_PUBLICO
cd /opt/cashflow
cp .env.production.example .env.production
nano .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Validacao em cloud

```bash
curl http://SEU_IP_PUBLICO/health
curl http://SEU_IP_PUBLICO/api/health
curl http://SEU_IP_PUBLICO/api/metrics
```

Criar lancamento:

```bash
curl -X POST http://SEU_IP_PUBLICO/api/transactions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_API_KEY" \
  -d '{
    "merchant_id": "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
    "client_request_id": "9e6f2a1e-4b12-4977-875d-dba617b7a450",
    "type": "CREDIT",
    "amount": "100.00",
    "description": "Venda em producao",
    "occurred_at": "2026-05-20T10:00:00"
  }'
```

Consultar saldo:

```bash
curl -H "X-API-Key: SUA_API_KEY" \
  "http://SEU_IP_PUBLICO/api/daily-balances/2026-05-20?merchant_id=8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11"
```

Verificar servicos:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api worker outbox-dispatcher
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres psql -U cashflow -d cashflow -c "SELECT * FROM alembic_version;"
docker compose --env-file .env.production -f docker-compose.prod.yml exec rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
```

## Teste offline do portal

1. Abrir o portal uma vez com internet.
2. Confirmar que o navegador instalou/cacheou o PWA.
3. Desligar a rede do computador do operador.
4. Reabrir o portal.
5. Registrar uma movimentacao.
6. Confirmar que ela aparece como `Pendente`.
7. Religar a rede.
8. Confirmar sincronizacao automatica, remocao da pendencia e consolidado atualizado.

## Backup minimo

Backup manual do PostgreSQL:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U cashflow cashflow > cashflow-backup-$(date +%Y%m%d%H%M%S).sql
```

Em producao real, automatizar backup diario e armazenar fora da VM. No caminho gratuito, o backup local na propria VM nao protege contra perda do disco.

## Limites do caminho gratuito

- Capacidade Always Free pode estar indisponivel temporariamente na regiao.
- Oracle pode sinalizar instancia Always Free ociosa conforme as regras do provedor.
- Sem dominio, o acesso fica por IP e HTTP.
- Com dominio, Caddy emite HTTPS automaticamente sem custo adicional.
- Banco e RabbitMQ ficam no mesmo host; para maior disponibilidade, evoluir para servicos gerenciados ou cluster.
