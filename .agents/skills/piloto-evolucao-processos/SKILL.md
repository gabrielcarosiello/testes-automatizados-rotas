---
name: piloto-evolucao-processos
description: Mapeia regras e consumidores de módulos do Piloto MES + S7 para revisar mudanças por processo. Use para evoluir ou documentar Transporte, Recebimento e Dosagem com rastreabilidade entre regra, implementação e validação.
metadata:
  version: "0.7.0"
---

# Evolução dos processos do Piloto

1. Identifique o processo e o comportamento afetado. Consulte a [matriz de processos](references/matriz-processos.md) e abra somente os pontos de entrada e consumidores necessários.
2. Separe regras próprias do processo de serviços reutilizados. Comprove o uso por importação ou chamada. Registre como candidato todo reaproveitamento ainda sem consumidor comprovado.
3. Para cada mudança autorizada, registre a regra, a fonte, os consumidores atingidos e a evidência esperada. Use os critérios do [manual](../../../MANUAL_OPERACAO.md), seção 8, para conferir a operação e o fluxo de recuperação.
4. Para desenvolver uma função semelhante, use o [roteiro de reaproveitamento](references/reaproveitamento.md). Consulte [Recebimento](references/recebimento.md) para regras de ordem, produto, silo e retomada. Dosagem segue em levantamento.
5. Use o roteiro Cypress local abaixo para escolher a evidência e a menor validação que cubra a mudança.
6. Registre alterações documentais no [changelog](../../../CHANGELOG.md). Distinga leitura de código, regressão e ensaio em bancada no registro da revisão.

Priorize os módulos, configurações, evidências e skills internas. Trabalhe em etapas pequenas, com uma rodada direcionada por etapa e nova execução quando uma falha concreta exigir. Use subagentes somente se solicitados.

Para analisar um lote, aguarde confirmação de término. Use os resultados e evidências já gravados. Execução de specs, comandos no MES e operações S7 dependem do escopo autorizado na tarefa.

## Roteiro Cypress local

- [Cypress Explain](../cypress-explain/SKILL.md) para explicar ou auditar. Comece pelo erro, Command Log e captura. Siga o spec até o helper, a tarefa Node e o registro que comprovam o resultado.
- [Cypress Author](../cypress-author/SKILL.md) para desenvolver ou corrigir. Reuse os helpers da modalidade, confirme a identidade da operação, prefira condições observáveis e mantenha o diff e a regressão limitados à regra afetada.
- [Cypress Docs](../cypress-docs/SKILL.md) para dúvidas de API da versão instalada. Em tarefas exclusivamente locais, confira os tipos, o código instalado e os usos do projeto. Registre as dúvidas que essas fontes deixarem em aberto.
- [Cypress Tap](../cypress-tap/SKILL.md) para sessão local autorizada. Identifique sessão e spec, confirme o início de uma execução nova antes de atribuir um veredito e preserve os logs e evidências do lote.

## Onde criar e como validar regressões

- Crie os novos testes locais do Piloto em `mes-s7-piloto/regressao/<processo>/`. Use `comum/` para serviços compartilhados e `s7/` para integração S7. Nomeie os arquivos `*.test.js`, `*.test.cjs` ou `*.test.mjs` e guarde os dados auxiliares em `regressao/fixtures/`.
- Mantenha as specs que operam o MES em `mes-s7-piloto/testes/` e as regressões do serviço Monitor em `monitor-s7/test/`. Use fixtures, arquivos temporários e serviços simulados locais na regressão.
- Rode primeiro o teste afetado e use o verificador da raiz para conferir mudanças em código compartilhado ou na descoberta. Siga o [procedimento de regressão](../../../MANUAL_OPERACAO.md#regressao-local) e registre os grupos executados e o resultado.

## Evidência obrigatória para novos testes do Piloto

- Abra um diário JSONL por execução antes do login ou de qualquer ação no MES. Use o gravador do Piloto e registre início, identidade do cenário, etapas antes das ações e resultado final, inclusive falhas anteriores ao cadastro ou à partida.
- Na falha, registre a etapa, o erro sanitizado e a captura da tela. O Command Log do runner complementa o diário persistido. Omita credenciais e aplique blackout nos campos de senha.
- Valide o caminho do diário, a última etapa gravada e a captura em um caso de falha, além do resultado no caso nominal. Na análise de falha, leia esses arquivos antes de alterar o fluxo ou repetir uma operação.

## Entregas entre processos

Use a evidência persistida e a identidade confirmada da operação como base para uma entrega. No Recebimento, use `dados.entrega` no diário SQL, com OR, item, produto, destino e peso. Consulte a regra R08 na matriz e o [procedimento no manual](../../../MANUAL_OPERACAO.md#entrega-recebimento). Reconfirme estoque atual quando a próxima fase for implementada.
