# Fluxo Online/Offline do Portal

## Objetivo

Permitir que o operador registre movimentações mesmo quando o portal já está aberto e a API ou a rede fica indisponível.

## Implementado

- Fila local em IndexedDB no portal operacional.
- Registro pendente com `local_id`, `client_request_id`, payload, status, tentativas, data de criação e último erro.
- Exibição de contador de pendências e selo `Pendente`, `Sincronizando` ou `Falha no envio` na tabela.
- Sincronização automática ao carregar a tela e quando o navegador sinaliza retorno online.
- Botão `Tentar enviar agora` apenas quando houver falha de sincronização.
- Idempotência na API por `client_request_id` com índice único em `transactions`.

## Regra de Idempotência

O portal envia `client_request_id` em cada `POST /transactions`.

Se a API receber novamente o mesmo `client_request_id`, ela retorna a transação existente sem criar nova linha em `transactions` e sem criar novo evento em `outbox_events`.

Isso evita duplicidade quando uma movimentação offline é reenviada após falha, recarregamento ou tentativa manual.

## Limites

- Os dados pendentes ficam somente no navegador do operador até a sincronização.
- Outro dispositivo não enxerga esses lançamentos antes do envio para a API.
- Se o navegador limpar dados locais, pendências ainda não sincronizadas podem ser perdidas.
- O saldo diário consolidado não inclui pendências locais; ele reflete apenas dados persistidos e processados no backend.
- PWA completo com service worker para abrir o portal sem rede não faz parte desta etapa.

## Evoluções Futuras

- Service worker e cache de app shell para abrir o portal sem rede.
- Criptografia local de pendências sensíveis.
- Política de expiração e alerta para pendências antigas.
- Observabilidade específica para taxa de sincronização offline.
- Sincronização em lote se o volume local crescer.
