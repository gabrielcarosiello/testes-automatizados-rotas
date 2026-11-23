# Cypress no Piloto MES + S7

O projeto Cypress fica em `mes-s7-piloto`. A especificação da bancada está em `testes/transferencias/transferencias.cy.js`. Os módulos de implementação ficam em `comum` e os arquivos `.test.js` verificam esses módulos.

As skills em `.agents/skills` vêm do [Cypress AI Toolkit](https://github.com/cypress-io/ai-toolkit/tree/e40f7be90bf1c09de6064ddaa36f0cefc3a59df0). Use `$cypress-author` para criar ou corrigir testes, `$cypress-explain` para revisar o fluxo e `$cypress-docs` para consultar APIs e comportamento da versão instalada.

Para verificar mudanças em código, execute `node verificar-tudo.cjs` na raiz de uma cópia local no Windows. Essa suíte cobre o Piloto, o Monitor e a integração S7 simulada. Siga a seção [Revisão de versão](MANUAL_OPERACAO.md#revisão-de-versão-com-as-cypress-ai-skills) para registrar o resultado.

Use `$cypress-tap` na máquina em que o Cypress está aberto, com a CLI local da pasta `mes-s7-piloto`. Comece com `npx.cmd cypress tap sessions --json` e `npx.cmd cypress tap status --json` para identificar a sessão e o lote. Depois do término, consulte `npx.cmd cypress tap reporter` e filtre o teste de interesse se precisar do Command Log. Proteja credenciais e valores sensíveis ao citar logs ou snapshots.

A especificação de transferências pode enviar comandos ao MES, escrever a LSH via Monitor e atualizar a LIR. Durante um lote ativo, acompanhe `eventos.jsonl` e as evidências já gravadas. Antes de executar ou repetir o spec via `tap`, confira a seleção de rotas em `execucao.local.json`, a sessão da bancada e eventual pendência de restauração. Siga o procedimento em [Manual de operação](MANUAL_OPERACAO.md#10-recuperar-escrita-pendente).
