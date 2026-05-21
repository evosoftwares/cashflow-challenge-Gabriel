# Evoluções com IA

O desafio não exige componentes de inteligência artificial no escopo obrigatório. A solução mantém o núcleo transacional simples, auditável e resiliente, priorizando registro de lançamentos, consolidação diária, mensageria, idempotência, segurança básica, observabilidade e documentação arquitetural.

Como a vaga está relacionada a Arquitetura de Soluções de IA, a base construída permite evoluções futuras com IA sem distorcer o problema principal.

## Princípio Arquitetural

IA não deve ser adicionada ao fluxo crítico de gravação financeira sem necessidade comprovada.

O fluxo de `POST /transactions`, Outbox, RabbitMQ, worker e atualização de `daily_balances` deve continuar determinístico, rastreável e transacional. Capacidades de IA devem ser acopladas preferencialmente como consumidores ou camadas analíticas, sem bloquear o registro de lançamentos nem a consulta operacional do saldo.

## Casos de Uso Possíveis

### Previsão de Fluxo de Caixa

Usar o histórico de lançamentos e saldos consolidados para prever entradas, saídas e saldo provável dos próximos dias.

Valor para o negócio:

- antecipar risco de saldo negativo;
- apoiar planejamento financeiro do comerciante;
- identificar sazonalidade de vendas e despesas.

Arquitetura sugerida:

```text
transactions / daily_balances
        ↓
camada analítica
        ↓
modelo de previsão
        ↓
API ou painel de insights
```

### Detecção de Anomalias

Identificar lançamentos fora do padrão, como valores muito altos, débitos incomuns ou volume atípico em determinado período.

Valor para o negócio:

- reduzir risco operacional;
- apoiar auditoria;
- alertar sobre movimentações suspeitas.

Arquitetura sugerida:

```text
eventos de lançamento
        ↓
serviço de análise assíncrona
        ↓
score de anomalia
        ↓
alerta operacional
```

### Classificação Automática de Lançamentos

Usar a descrição do lançamento para sugerir categorias como venda, taxa, aluguel, fornecedor, imposto ou ajuste.

Valor para o negócio:

- melhorar organização financeira;
- reduzir trabalho manual;
- permitir relatórios por categoria.

Arquitetura sugerida:

```text
description
        ↓
classificador
        ↓
categoria sugerida
        ↓
confirmação ou ajuste pelo operador
```

### Assistente Operacional

Disponibilizar um assistente para perguntas sobre movimentações e consolidado, por exemplo:

- "Qual foi meu saldo no dia 20?"
- "Quanto tive de saída esta semana?"
- "Quais foram os maiores débitos do mês?"

Valor para o negócio:

- facilitar consulta por usuários não técnicos;
- reduzir dependência de relatórios manuais;
- tornar a análise financeira mais acessível.

Arquitetura sugerida:

```text
pergunta do usuário
        ↓
camada de orquestração
        ↓
consultas controladas na API/banco
        ↓
resposta explicável
```

## Governança e Segurança

Qualquer evolução com IA deve respeitar:

- autorização por comerciante;
- segregação de dados entre merchants;
- mascaramento ou minimização de dados sensíveis;
- trilha de auditoria para recomendações ou alertas;
- explicabilidade mínima das respostas;
- métricas de qualidade do modelo;
- avaliação de falso positivo e falso negativo;
- possibilidade de revisão humana.

## O Que Não Fazer Neste Escopo

Não faz sentido adicionar IA agora para:

- decidir se uma transação deve ser gravada;
- alterar saldo consolidado automaticamente;
- substituir idempotência, transação ou mensageria;
- bloquear o fluxo operacional do comerciante;
- introduzir dependência externa obrigatória no caminho crítico.

Esses pontos aumentariam o risco da solução e fugiriam do objetivo do desafio.

## Plano de Evolução Recomendado

1. Coletar histórico suficiente de `transactions` e `daily_balances`.
2. Criar dataset analítico separado do banco transacional.
3. Definir métricas de negócio para previsão, anomalia ou classificação.
4. Implementar primeiro modelos simples e explicáveis.
5. Expor insights como leitura complementar no portal.
6. Medir impacto antes de automatizar qualquer decisão.

## Decisão

A solução atual não implementa IA porque o desafio não exige essa capacidade e o domínio principal é transacional. A arquitetura, porém, deixa uma base adequada para evoluções de IA em camadas analíticas e assíncronas, preservando confiabilidade, auditabilidade e simplicidade operacional.
