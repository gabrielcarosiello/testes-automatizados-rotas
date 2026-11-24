# Matriz de processos do Piloto

Base observada no código do Piloto 11.4 em 23/11/2026. As regras de Transporte descrevem o fluxo implementado. A matriz de módulos lista consumidores diretos verificados e cobre os pontos de integração principais.

## Transporte

| ID | Regra implementada | Fonte |
| --- | --- | --- |
| T01 | A seleção parte da LIR e da configuração de execução. O spec usa a sessão compartilhada preparada pelos testes de login e navegação. | [Configuração Cypress](../../../../mes-s7-piloto/cypress.config.js), [ponto de entrada](../../../../mes-s7-piloto/testes/transferencias/transferencias.cy.js) e [seleção LIR](../../../../mes-s7-piloto/testes/transferencias/selecao-lir.js) |
| T02 | Selecionar local, transferência, origem, destino e rota exata. A preparação bloqueia diante de transferência ativa ou ambígua. O botão **Iniciar** desabilitado gera captura e, no modo MES + S7, diagnóstico de leitura dos equipamentos. | [Orquestração](../../../../mes-s7-piloto/testes/transferencias/rotas-transferencias.js), [segurança de cartões](../../../../mes-s7-piloto/testes/transferencias/seguranca-cartoes.js) e [diagnóstico no MES](../../../../mes-s7-piloto/comum/impedimento-transferencia.js) |
| T03 | No modo MES + S7, os vínculos SQL, o catálogo e os perfis determinam os retornos esperados. A observação começa após a partida sem aguardar o cartão **Iniciado**. A validação normal exige retorno S7 e confirmação no MES. | [Piloto S7](../../../../mes-s7-piloto/comum/s7/piloto.js), [perfis](../../../../mes-s7-piloto/comum/s7/perfis.js) e [orquestração](../../../../mes-s7-piloto/testes/transferencias/rotas-transferencias.js) |
| T04 | Recusa por nível alto deve corresponder ao destino da rota. O rearme exige configuração explícita de PLCSIM e condições verificadas. Quando o fluxo admite nova tentativa, ela é única. Segunda recusa com S7 normal pode adiar o mesmo destino no local até o próximo lote. | [Recusa de partida](../../../../mes-s7-piloto/testes/transferencias/recusa-partida.js), [orquestração](../../../../mes-s7-piloto/testes/transferencias/rotas-transferencias.js) e [controle da LSH](../../../../mes-s7-piloto/comum/s7/nivel-alto.js) |
| T05 | Ensaio aplicável e habilitado exige LSH conforme NA/NF, amostra válida com `Alm` ou `Aviso` e cartão **Nível Alto** no MES. O sinal `Silo[X].Niveis.Alto` no DB11 orienta o diagnóstico quando o cadastro SQL e a leitura puderem ser confirmados. | [Controle da LSH](../../../../mes-s7-piloto/comum/s7/nivel-alto.js), [leitura do cartão](../../../../mes-s7-piloto/comum/nivel-alto-mes.js) e [consulta SQL](../../../../mes-s7-piloto/comum/s7/consultarRota.js) |
| T06 | Persistir a intenção antes da escrita. Restaurar o valor original com releitura e na sessão proprietária. Uma pendência em disco bloqueia outro ensaio. A proteção de prazo pode atuar enquanto o Node permanece ativo. | [Estado persistente](../../../../mes-s7-piloto/comum/s7/estado-escrita.js), [controle da LSH](../../../../mes-s7-piloto/comum/s7/nivel-alto.js) e [recuperação operacional](../../../../MANUAL_OPERACAO.md#10-recuperar-escrita-pendente) |
| T07 | Confirmar liberação do local no MES. A limpeza de uma rota interrompida exige identificação do cartão da rota e diagnóstico. A parada de recuperação depende do mesmo cartão observado em **Iniciado** e das guardas de execução e restauração. | [Diagnóstico e limpeza](../../../../mes-s7-piloto/comum/impedimento-transferencia.js) e [recuperação de encerramento](../../../../mes-s7-piloto/comum/recuperar-encerramento.js) |
| T08 | Registrar eventos, evidências S7 e histórico Rev 00. A LIR recebe o resultado normal, o nível alto quando aplicável e o resumo dos equipamentos afetados quando houver diagnóstico. O histórico mantém as leituras detalhadas. | [Tarefas Rev 00](../../../../mes-s7-piloto/testes/transferencias/config.js) e [gravação LIR](../../../../mes-s7-piloto/testes/transferencias/lir-rotas.js) |

## Módulos compartilhados e consumidores

Caminhos relativos a `mes-s7-piloto/`. O uso compartilhado abaixo foi observado dentro do Piloto. O reaproveitamento por Recebimento e Dosagem está pendente.

| Módulo | Responsabilidade | Consumidores diretos verificados | Regras |
| --- | --- | --- | --- |
| [execucao.js](../../../../mes-s7-piloto/comum/execucao.js) | Carrega as opções de execução. | `cypress.config.js`, `scripts/diagnosticar.cjs`, `scripts/reparar-planilha.cjs`, `scripts/verificar-catalogo.cjs` | T01 |
| [cartoes-mes.js](../../../../mes-s7-piloto/comum/cartoes-mes.js) | Interpreta cartões, comandos e confirmação de local livre. | `comum/consultas-mes.js`, `comum/aguardar-transferencias.js`, `comum/limpar-transferencia.js`, `comum/impedimento-transferencia.js`, `comum/recuperar-encerramento.js`, `testes/transferencias/recusa-partida.js`, `testes/transferencias/rotas-transferencias.js` | T02, T04, T07 |
| [limpar-transferencia.js](../../../../mes-s7-piloto/comum/limpar-transferencia.js) | Conduz a limpeza e confirma o encerramento. | `comum/impedimento-transferencia.js`, `testes/transferencias/rotas-transferencias.js` | T07 |
| [s7/cliente-monitor.js](../../../../mes-s7-piloto/comum/s7/cliente-monitor.js) e [s7/estado-escrita.js](../../../../mes-s7-piloto/comum/s7/estado-escrita.js) | Cliente HTTP do Monitor e controle persistente da escrita. | Ambos são usados por `comum/s7/piloto.js` e `scripts/diagnosticar.cjs`. | T03, T06 |
| [s7/indice-catalogo.js](../../../../mes-s7-piloto/comum/s7/indice-catalogo.js) e [s7/catalogo-projeto.js](../../../../mes-s7-piloto/comum/s7/catalogo-projeto.js) | Indexação, obtenção do catálogo e conferência de sinais. | Ambos são usados por `comum/s7/piloto.js` e `scripts/verificar-catalogo.cjs`. O índice também atende `comum/s7/nivel-alto.js` e `comum/s7/gerarRotaCLP.js`. | T03, T05 |
| [s7/consultarRota.js](../../../../mes-s7-piloto/comum/s7/consultarRota.js) | Consulta os vínculos de rota e o cadastro de silo. | `comum/s7/piloto.js` usa `consultarRota`; `cypress.config.js` injeta `consultarSilo`. | T03, T05 |
| [s7/nivel-alto.js](../../../../mes-s7-piloto/comum/s7/nivel-alto.js) e [s7/diagnostico-equipamentos.js](../../../../mes-s7-piloto/comum/s7/diagnostico-equipamentos.js) | Controles da LSH e leitura de estados dos equipamentos. | Ambos atendem `comum/s7/piloto.js`. O primeiro também atende `cypress.config.js` e `scripts/verificar-catalogo.cjs`; o segundo atende `scripts/diagnosticar.cjs`. | T02, T04, T05, T06, T07 |
| [registro-execucao.js](../../../../mes-s7-piloto/comum/registro-execucao.js) | Grava o diário e fornece a classificação das falhas. | `comum/s7/piloto.js` e `testes/transferencias/config.js` | T06, T08 |
| [gravar-lir.js](../../../../mes-s7-piloto/comum/gravar-lir.js) | Atualiza ou recupera a planilha preservando sua estrutura. | `testes/transferencias/lir-rotas.js` e `scripts/reparar-planilha.cjs` | T08 |

## Recebimento

Consulte a [matriz de compartilhamento e o cenário inicial](recebimento.md).

**Pendente de levantamento.** Confirmar o ponto de entrada do MES, as condições de liberação e encerramento, os vínculos SQL, os sinais de confirmação e os registros esperados. Fonte inicial para a próxima revisão: fluxo operacional e implementação identificada pelo responsável pelo processo.

## Dosagem

**Pendente de levantamento.** Confirmar os gatilhos e estados do ciclo de dosagem, as grandezas e tolerâncias, os vínculos SQL/S7 e a recuperação de ciclo incompleto. Fonte inicial para a próxima revisão: critérios de operação e implementação identificada pelo responsável pelo processo.
