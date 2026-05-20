# ADR-001 - Adoção de Arquitetura Modular

## Decisão

Foi adotada uma arquitetura modular em vez de microsserviços independentes.

## Justificativa

O domínio do desafio é pequeno e composto principalmente por duas capacidades: controle de lançamentos e consolidação diária.

A arquitetura modular reduz complexidade operacional, facilita execução local e mantém separação clara entre os domínios.

## Trade-off

A solução não possui deploy independente por domínio neste momento.

Caso o domínio cresça, os módulos podem ser extraídos futuramente para microsserviços.
