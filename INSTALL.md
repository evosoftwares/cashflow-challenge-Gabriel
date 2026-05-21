# Instalar e Usar Localmente

Este é o caminho recomendado para o avaliador baixar e executar a aplicação completa na própria máquina.

O sistema sobe com Docker Compose e abre tudo localmente:

- portal operacional React;
- API FastAPI;
- PostgreSQL;
- RabbitMQ;
- worker de consolidação;
- outbox dispatcher;
- migrations Alembic.

Não é necessário instalar Python, Node.js, PostgreSQL ou RabbitMQ manualmente.

## 1. Instale os pré-requisitos

Instale apenas:

- Git: https://git-scm.com/downloads
- Docker Desktop: https://www.docker.com/products/docker-desktop/

No Windows, abra o Docker Desktop e aguarde o status indicar que o Docker está rodando antes de iniciar o projeto.

### Se você ainda não tem Docker

Sem Docker, a aplicação completa não sobe pelo caminho oficial, porque o projeto depende de containers para iniciar API, portal, PostgreSQL, RabbitMQ, worker, outbox dispatcher e migrations de banco.

Instale conforme o sistema operacional:

| Sistema | Caminho recomendado |
| --- | --- |
| Windows 10/11 | Instalar Docker Desktop pelo guia oficial: https://docs.docker.com/desktop/setup/install/windows-install/ |
| macOS | Instalar Docker Desktop pelo guia oficial: https://docs.docker.com/desktop/setup/install/mac-install/ |
| Linux | Instalar Docker Engine pelo guia oficial: https://docs.docker.com/engine/install/ |

No Windows, se o instalador pedir WSL 2, aceite a configuração recomendada. Depois da instalação:

1. Abra o Docker Desktop.
2. Aguarde o status indicar que o Docker está rodando.
3. Feche e abra novamente o terminal.
4. Verifique:

```bash
docker --version
docker compose version
docker info
```

Se esses três comandos funcionarem, o projeto está pronto para subir.

Alternativa sem Docker existe apenas como execução manual de desenvolvimento, exigindo instalação separada de Python, Node.js, PostgreSQL e RabbitMQ. Ela não é o caminho oficial da entrega, porque aumenta muito a chance de erro no ambiente do avaliador.

## 2. Baixe o projeto

Opção recomendada, usando Git:

```bash
git clone https://github.com/evosoftwares/cashflow-challenge-Gabriel.git
cd cashflow-challenge-Gabriel
```

Opção sem Git:

1. Acesse `https://github.com/evosoftwares/cashflow-challenge-Gabriel`.
2. Clique em `Code`.
3. Clique em `Download ZIP`.
4. Extraia o ZIP.
5. Abra o terminal dentro da pasta extraída.

## 3. Suba a aplicação

### Windows

Caminho mais simples:

```powershell
.\start.bat
```

Alternativa PowerShell:

```powershell
.\start.ps1
```

Se o PowerShell bloquear scripts, use `start.bat`, pois ele já executa o projeto com a permissão local necessária para este comando.

### macOS ou Linux

```bash
./start.sh
```

Se o sistema informar falta de permissão:

```bash
chmod +x start.sh
./start.sh
```

Na primeira execução, o Docker vai baixar imagens e instalar dependências. Isso pode levar alguns minutos.

## 4. Acesse o sistema

Quando os containers estiverem em execução, abra:

```text
http://localhost:5173
```

URLs úteis:

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

## 5. Use o portal

1. Abra `http://localhost:5173`.
2. Use o comerciante de demonstração já preenchido ou gere um novo.
3. Escolha a data de operação.
4. Registre uma entrada ou saída.
5. Confira a movimentação na tabela.
6. Veja o resumo diário atualizar automaticamente.

O operador não precisa digitar chave técnica no portal. A API Key local já é configurada pelo ambiente Docker.

## 6. Parar o sistema

No terminal onde o Docker Compose está rodando, pressione:

```text
Ctrl + C
```

Depois, para encerrar os containers:

```bash
docker compose down
```

Para apagar também os dados locais de teste:

```bash
docker compose down -v
```

## Solução de problemas

### Docker não encontrado

Instale o Docker Desktop ou Docker Engine conforme o seu sistema:

- Windows: https://docs.docker.com/desktop/setup/install/windows-install/
- macOS: https://docs.docker.com/desktop/setup/install/mac-install/
- Linux: https://docs.docker.com/engine/install/

Depois abra um novo terminal e rode:

```bash
docker --version
docker compose version
```

### Docker não está rodando

Abra o Docker Desktop e aguarde a inicialização.

No Linux, inicie o serviço do Docker conforme a distribuição usada.

### Docker Compose não encontrado

Atualize o Docker Desktop ou instale o plugin Docker Compose:

```text
https://docs.docker.com/compose/install/
```

### Porta ocupada

As portas usadas são:

- `5173`: portal;
- `8000`: API;
- `5432`: PostgreSQL;
- `5672`: RabbitMQ;
- `15672`: painel RabbitMQ.

Se alguma estiver ocupada, pare o processo que usa a porta ou rode:

```bash
docker compose down
```

### Quero começar do zero

```bash
docker compose down -v
docker compose up --build
```

### Verificar se a API está viva

```bash
curl http://localhost:8000/health
```

Resposta esperada:

```json
{"status":"ok"}
```
