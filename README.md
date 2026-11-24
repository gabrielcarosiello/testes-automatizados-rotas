<div align="center">

# Piloto MES e S7

### Testes de Transporte com Cypress, SQL Server e Monitor Siemens S7

![Piloto](https://img.shields.io/badge/Piloto-12-167D8D?style=flat-square)
![Monitor](https://img.shields.io/badge/Monitor-0.13.0-263B68?style=flat-square)
![Documentação](https://img.shields.io/badge/Documenta%C3%A7%C3%A3o-Rev04-6D55A3?style=flat-square)

**[Manual de operação](MANUAL_OPERACAO.md) · [Manual visual](documentacao/visual/Piloto_12_Manual_Visual_Rev04.html) · [Matriz de processos](.agents/skills/piloto-evolucao-processos/references/matriz-processos.md) · [Histórico](CHANGELOG.md)**

</div>

---

O piloto verifica o fluxo de Transporte no MES e, no modo integrado, cruza os equipamentos cadastrados no SQL com os retornos S7. Os ensaios registram partida, nível alto quando aplicável, restauração, encerramento e resultados na LIR.

> **Versão:** a branch se chama `piloto-11`; o código atual se identifica como **Piloto-12**. A revisão documental 04 não altera o funcionamento da aplicação.

## Comece pelo documento certo

| Você precisa de… | Consulte |
| --- | --- |
| Preparar a instalação e configurar MES, SQL e S7 | [Manual de operação](MANUAL_OPERACAO.md#2-preparação-e-instalação) |
| Ler com cores, busca e navegação lateral | [Manual visual em HTML](documentacao/visual/Piloto_12_Manual_Visual_Rev04.html) — baixe e abra no navegador |
| Tratar uma escrita pendente ou interrupção | [Recuperação operacional](MANUAL_OPERACAO.md#10-recuperar-escrita-pendente) |
| Entender os condicionamentos do Transporte | [Matriz de regras e consumidores](.agents/skills/piloto-evolucao-processos/references/matriz-processos.md) |
| Investigar um erro conhecido | [Diagnóstico](MANUAL_OPERACAO.md#11-diagnóstico-de-erros) e [registro de estabilidade](mes-s7-piloto/docs/PILOTO_11_ESTABILIDADE.md) |
| Medir o tempo das etapas | [Estudo de desempenho do Piloto-12](mes-s7-piloto/docs/DESEMPENHO_PILOTO_12.md) |
| Revisar uma alteração antes da liberação | [Regressão](MANUAL_OPERACAO.md#14-eficiência-manutenção-e-regressão) e [skill de evolução](.agents/skills/piloto-evolucao-processos/SKILL.md) |

## Preparação rápida

Use **Windows e Node.js 22 ou superior**. O Node é instalado uma vez no computador; as dependências são instaladas nas duas subpastas:

```powershell
# A partir da raiz do repositório
Set-Location .\mes-s7-piloto
npm.cmd ci
Set-Location ..\monitor-s7
npm.cmd ci
Set-Location ..
```

Forneça as configurações locais, a LIR e o projeto TIA da bancada antes de iniciar. Esses recursos não devem ser presumidos como parte do clone. Veja o [procedimento completo](MANUAL_OPERACAO.md#3-configuração-mes-e-sql).

| Terminal | Diretório | Comando | Finalidade |
| --- | --- | --- | --- |
| Monitor | `monitor-s7` | `npm.cmd start` | Iniciar o serviço HTTP local |
| Diagnóstico | `mes-s7-piloto` | `npm.cmd run diagnostico -- --monitor` | Conferir configuração, LIR, pendência e API |
| Cypress | `mes-s7-piloto` | `npm.cmd run abrir` | Abrir o runner para execução controlada |
| Regressão | Raiz | `node verificar-tudo.cjs` | Verificar Piloto, Monitor e integração simulada |

> **Operação da bancada:** executar a spec pode comandar o MES, escrever a LSH e atualizar a LIR. Confirme o ambiente, mantenha uma execução por bancada e confira a restauração e o local vazio antes de retomar um lote interrompido.

## Organização por processo

| Processo | Situação nesta branch | Referência |
| --- | --- | --- |
| Transporte | Implementado; critérios e limites registrados | T01–T08 na matriz |
| Recebimento | Pendente de levantamento | Confirmar fluxo e condições próprias |
| Dosagem | Pendente de levantamento | Confirmar ciclo, tolerâncias e recuperação |

Reaproveite serviços somente após comprovar a equivalência do comportamento. Mudanças em módulos comuns exigem análise dos consumidores e regressão correspondente.

## Sobre a documentação

O manual visual funciona offline, sem bibliotecas externas. Inclui o manual operacional, a matriz existente e o estudo de desempenho. O GitHub apresenta o código do HTML; baixe o arquivo para visualizar o layout no navegador. O Markdown permanece como fonte editável dos procedimentos.

Os números de testes e as medições mantêm a identificação da revisão que os produziu. A revisão documental 04 verificou apresentação, links e integridade dos arquivos funcionais; não executou novos testes contra a bancada.

[Alterações desta revisão](documentacao/REVISAO_DOCUMENTAL_Rev04.md) · [Changelog](CHANGELOG.md)
