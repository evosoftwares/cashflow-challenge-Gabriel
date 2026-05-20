# Arquitetura de Transição

Não foi considerada migração de sistema legado neste desafio, pois o cenário descreve uma solução nova para controle de fluxo de caixa.

Caso houvesse legado, a estratégia recomendada seria:

1. Manter o sistema legado como origem temporária.
2. Criar integração para publicar lançamentos na fila.
3. Processar os eventos na nova consolidação.
4. Migrar gradualmente os consumidores para a nova API.
5. Desativar o legado após validação dos saldos.

## Cuidados de transição

- Reconciliar saldos entre legado e nova consolidação.
- Processar lançamentos históricos em lotes.
- Usar idempotência também na carga histórica.
- Manter trilha de auditoria das divergências encontradas.
