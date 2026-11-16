# Testes automatizados de rotas

Projeto Cypress para testar rotas de transferência. As pastas de recebimentos e dosagem estão reservadas para testes futuros.

## Requisitos

- Windows com Node.js, npm e PowerShell.
- Aplicação MES acessível no ambiente de teste.
- Para as capturas do supervisório, manter a tela do Elipse visível durante a execução.

## Preparação

1. Na pasta do projeto, instale as dependências:

   ```powershell
   npm install
   ```

2. Copie `credenciais.exemplo.json` para `credenciais.local.json` e preencha `senhaMES`. O arquivo local é ignorado pelo Git e a senha não deve ser publicada.
3. Coloque **uma única planilha real `.xlsx`** em `planilhas/`. O código ignora o modelo `CLXXX.00.LIR.00.xlsx` e arquivos temporários do Excel. Se houver mais de uma planilha real, o teste informa o problema sem escolher automaticamente.
4. Para criar uma planilha, copie o modelo com outro nome e confira os dados e os valores da coluna **Teste**. O modelo contém rotas de exemplo já preenchidas.
5. Feche a planilha no Excel ou LibreOffice antes de executar, para permitir o registro dos resultados.

## Execução

```powershell
npx cypress open
```

Escolha **E2E Testing**, o navegador e `testes/transferencias/transferencias.cy.js`. A execução começa com uma pausa para preparar o ambiente.

- `NT` e `NOK`: a rota entra no teste.
- `OK` e `---`: a rota é ignorada.
- Ao concluir, o teste tenta preencher `Teste`, `Data` e `Falha Identificada` na planilha real.
- Prints e históricos de tempos são salvos em `resultados/`, que é ignorada pelo Git.

Se a gravação do resultado falhar, confira o aviso no Cypress e o histórico antes de repetir. Para carregar a lista atualizada de rotas pendentes, feche e abra o Cypress novamente.

## Estrutura

- `testes/transferencias/`: teste de transferências e suas funções de apoio.
- `testes/recebimentos/` e `testes/dosagem/`: áreas reservadas para os testes futuros.
- `planilhas/`: modelo versionado e planilha real local.
- `comum/`: script para captura das telas.
- `cypress.config.js` e `cypress.base.config.js`: configuração do Cypress e da captura.

O modelo contém várias abas e nomes de rotas como exemplo; o teste atual usa somente a aba **Lista de Rotas - Transferências**. A planilha real, as credenciais, `node_modules/` e `resultados/` não devem ser enviados ao repositório.
