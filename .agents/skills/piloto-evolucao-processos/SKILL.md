---
name: piloto-evolucao-processos
description: Mapeia regras e consumidores de módulos do Piloto MES + S7 para revisar mudanças por processo. Use para evoluir ou documentar Transporte, Recebimento e Dosagem com rastreabilidade entre regra, implementação e validação.
metadata:
  version: "0.1.0"
---

# Evolução dos processos do Piloto

1. Identifique o processo e o comportamento afetado. Consulte a [matriz de processos](references/matriz-processos.md) e abra somente os pontos de entrada e consumidores necessários.
2. Separe regras próprias do processo de serviços reutilizados. Comprove o uso por importação ou chamada. Registre como candidato todo reaproveitamento ainda sem consumidor comprovado.
3. Para cada mudança autorizada, registre a regra, a fonte, os consumidores atingidos e a evidência esperada. Use os critérios do [manual](../../../MANUAL_OPERACAO.md#8-etapas-e-critérios-do-teste) para conferir a operação e o fluxo de recuperação.
4. Quando houver levantamento incompleto, indique o que falta e a fonte esperada. Recebimento e Dosagem aguardam confirmação de seus fluxos próprios.
5. Registre alterações documentais no [changelog](../../../CHANGELOG.md). Distinga leitura de código, regressão e ensaio em bancada no registro da revisão.

Para analisar um lote, aguarde confirmação de término. Use os resultados e evidências já gravados. Execução de specs, comandos no MES e operações S7 dependem do escopo autorizado na tarefa.
