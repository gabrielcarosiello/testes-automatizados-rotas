# Auditoria do Piloto-12 · Rev06

25/11/2026 · branch **piloto-12-recebimento** · HEAD **51a94cc**. Revisão das entradas Cypress, módulos comuns, Monitor, scripts e documentação rastreados, incluindo a mudança local de estoque da origem. A busca por referências nominais encontrou consumidores ou menções para todos os módulos JS/CJS inspecionados em comum e testes. Menções documentais sozinhas não comprovam uso em execução.

## Candidatos à limpeza

| Arquivo | Evidência | Tratamento proposto |
| --- | --- | --- |
| `documentacao/VALIDACAO_DOCUMENTAL_Rev04 (1).json` | SHA-256 idêntico ao relatório da raiz. | Removida junto com o relatório da raiz. |
| `package-lock.json` da raiz | Lockfile sem dependências e sem manifesto nessa pasta. A instalação documentada usa os dois subprojetos. | Remover em revisão própria após conferir scripts externos. |
| `gerar_manual_visual.py` e `documentacao/gerar_manual_visual (1).py` | O primeiro contém JSON de validação. O segundo contém HTML. | Removidos do diretório de trabalho. |

O manual visual e o registro editorial da Rev04 também foram removidos. O histórico pode ser consultado no Git.

Preservar o gitlink `testes-automatizados-rotas` e os artefatos históricos com referência documental. Preservar os arquivos de configuração local até confirmar seus consumidores fora do repositório. Os testes com nome semelhante ao módulo são suítes de regressão. Os resultados de cadastro de OR alimentam o Recebimento e o registro de escrita pendente é necessário à recuperação.

## Validação

- Windows e Node v24.22.1, em cópia temporária com dependências locais. Regressão padrão com 163 testes do Piloto, 25 do Monitor e 5 de integração simulada. Suíte complementar com 16 testes de Recebimento, cadastro de OR e estoque da origem. Total de 209 aprovados, sem falhas ou testes pulados.
- Conferidos os links Markdown locais fora das skills Cypress incorporadas e as referências das regras T01–T09 e R01–R07. As fontes são o código atual e os relatos de bancada já registrados.
- Esta revisão executou somente testes locais. A retomada da OR com resposta **Não** ainda requer confirmação na VM. Dosagem segue como esboço.

[Manual de operação](../MANUAL_OPERACAO.md) · [Matriz de processos](../.agents/skills/piloto-evolucao-processos/references/matriz-processos.md)
