<div align="center">

# Piloto MES e S7

### Testes de Transporte e Recebimento com Cypress, SQL Server e Monitor Siemens S7

![Piloto](https://img.shields.io/badge/Piloto-12-167D8D?style=flat-square)
![Monitor](https://img.shields.io/badge/Monitor-0.13.0-263B68?style=flat-square)
![Documentação](https://img.shields.io/badge/Documenta%C3%A7%C3%A3o-Rev06-6D55A3?style=flat-square)

**[Manual de operação](MANUAL_OPERACAO.md) · [Matriz de processos](.agents/skills/piloto-evolucao-processos/references/matriz-processos.md) · [Histórico](CHANGELOG.md)**

</div>

---

O Piloto verifica Transporte, criação de ordens e Recebimento. Transporte e Recebimento a Granel usam MES, SQL e S7 conforme o cenário. Ensacados confirma a entrada em estoque por SQL.

> A documentação Markdown está na Rev06 do **Piloto-12**.

## Comece pelo documento certo

| Você precisa de… | Consulte |
| --- | --- |
| Preparar a instalação e configurar MES, SQL e S7 | [Manual de operação](MANUAL_OPERACAO.md#2-preparação-e-instalação) |
| Tratar uma escrita pendente ou interrupção | [Recuperação operacional](MANUAL_OPERACAO.md#10-recuperar-escrita-pendente) |
| Entender os condicionamentos do Transporte | [Matriz de regras e consumidores](.agents/skills/piloto-evolucao-processos/references/matriz-processos.md) |
| Investigar um erro conhecido | [Diagnóstico](MANUAL_OPERACAO.md#11-diagnóstico-de-erros) e [registro de estabilidade](mes-s7-piloto/docs/PILOTO_11_ESTABILIDADE.md) |
| Medir o tempo das etapas | [Estudo de desempenho do Piloto-12](mes-s7-piloto/docs/DESEMPENHO_PILOTO_12.md) |
| Revisar uma alteração antes da liberação | [Como funciona a regressão local](MANUAL_OPERACAO.md#regressao-local) e [skill de evolução](.agents/skills/piloto-evolucao-processos/SKILL.md) |

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
| Transporte | Implementado; critérios e limites registrados | T01–T09 na matriz |
| Recebimento | Grãos, Líquidos e Ensacados com cadastro e execução por cenário | [Regras e validações](.agents/skills/piloto-evolucao-processos/references/recebimento.md) |
| Dosagem | Pendente de levantamento | Confirmar ciclo, tolerâncias e recuperação |

Reaproveite serviços somente após comprovar a equivalência do comportamento. Mudanças em módulos comuns exigem análise dos consumidores e regressão correspondente.

## Sobre a documentação

Os números de testes e as medições mantêm a identificação da revisão que os produziu. A revisão documental 04 verificou apresentação, links e integridade dos arquivos funcionais; não executou novos testes contra a bancada.

[Auditoria da Rev06](documentacao/AUDITORIA_PILOTO_Rev06.md) · [Changelog](CHANGELOG.md)
