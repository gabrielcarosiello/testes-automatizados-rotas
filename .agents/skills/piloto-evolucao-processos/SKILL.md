---
name: piloto-evolucao-processos
description: Mapeia regras e consumidores de módulos do Piloto MES + S7 para revisar mudanças por processo. Use para evoluir ou documentar Transporte, Recebimento e Dosagem com rastreabilidade entre regra, implementação e validação.
metadata:
  version: "0.2.0"
---

# Evolução dos processos do Piloto

1. Identifique o processo e o comportamento afetado. Consulte a [matriz de processos](references/matriz-processos.md) e abra somente os pontos de entrada e consumidores necessários.
2. Separe regras próprias do processo de serviços reutilizados. Comprove o uso por importação ou chamada. Registre como candidato todo reaproveitamento ainda sem consumidor comprovado.
3. Para cada mudança autorizada, registre a regra, a fonte, os consumidores atingidos e a evidência esperada. Use os critérios do [manual](../../../MANUAL_OPERACAO.md), seção 8, para conferir a operação e o fluxo de recuperação.
4. Para incluir outro processo, registre entrada, permissivos, conclusão e recuperação com fontes próprias. Separe reutilização de código de configuração, estado e acesso à bancada. Use o [levantamento de Recebimento](references/recebimento.md) para classificar recursos e registrar respostas. Dosagem segue pendente.
5. Use Cypress Explain para mapear o fluxo existente, Cypress Author para planejar testes, Cypress Docs quando houver dúvida de API e Cypress Tap quando a inspeção de sessão for necessária e autorizada.
6. Registre alterações documentais no [changelog](../../../CHANGELOG.md). Distinga leitura de código, regressão e ensaio em bancada no registro da revisão.

Para analisar um lote, aguarde confirmação de término. Use os resultados e evidências já gravados. Execução de specs, comandos no MES e operações S7 dependem do escopo autorizado na tarefa.
