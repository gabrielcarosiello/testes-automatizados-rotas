# Changelog

## Piloto-12 — Recebimento Grãos RG (24/11/2026)

- Documentados cinco cenários candidatos de Recebimento, os dados de referência para criar ordens e os pontos a parametrizar no spec.
- A finalização por nível alto aciona Parar no cartão da ordem 9390 e confirma os dois diálogos de parada e finalização pelo texto.
- O ensaio de nível alto aguarda Parando para restaurar a LSH e confirma o painel de Recebimento livre antes de encerrar.
- A confirmação do nível alto no S7 dispara a abertura dos estados ocultos e a releitura imediata do cartão da ordem.
- O teste expande os estados do cartão do Recebimento para reconhecer Nível Alto quando o MES exibe Aguardando Finalização.
- O painel de nível alto do Recebimento agora exibe as leituras durante o acompanhamento e salva capturas também em caso de timeout.
- O Recebimento passou a exibir os retornos dos equipamentos no painel S7 e salvar capturas dos retornos, do nível alto e do MES.
- A configuração local pode desabilitar o ensaio de nível alto só no Recebimento para validar primeiro a partida e os retornos S7.
- O preparo S7 passou a ler a aba Lista de Rotas - Recebimento. A regressão com as duas abas confere rota, ordem e LSH antes da partida.
- O spec de Recebimento inicia a ordem ao ser selecionado no Cypress. O Recebimento usa a configuração S7 compartilhada com o Transporte e resolve o código da rota pela LIR.
- Integrada a validação inicial da ordem 9390 para MG01. O spec reutiliza a preparação S7, confirma os equipamentos e o cartão no MES, verifica nível alto e restaura a entrada com evidência própria.
- O vínculo pelo dbo.Recebimento e a finalização pelo MES ficam pendentes de validação na bancada.

## Revisão documental 05 — 24/11/2026

- Atualizada a skill piloto-evolucao-processos para 0.2.0.
- Registrados o planejamento de Recebimento, a matriz de compartilhamento e as perguntas do primeiro cenário.
- Piloto-12 permanece como versão funcional. Revisão por leitura de código e conferência documental.

## Revisão documental 04 — 24/11/2026

- Reescrito o README como ponto de entrada, com navegação e identificação coerente do Piloto-12 na branch `piloto-11`.
- Revisado o manual de operação com instruções de instalação nas duas subpastas, credenciais, diagnóstico e recuperação organizadas por assunto.
- Diferenciadas dependências atuais, resultados históricos e limites de validação; mantidos os registros de origem.
- Criado o manual visual offline, com sumário, pesquisa, impressão, cores por assunto e leitura responsiva.
- Incorporadas ao manual visual cópias de leitura da matriz de processos e do estudo de desempenho, sem alterar suas fontes.
- Acrescentados gerador visual, registro editorial e pacote de atualização documental. Código, parâmetros, testes, skill e regras de processo preservados.
- Validação desta revisão: links, layout e comparação de integridade com o commit de origem. Sem nova execução funcional ou operação da bancada.

## Piloto-12 — 23/11/2026

- Atualizada a identificação do piloto nos logs do Cypress, no evento inicial de novos lotes e na documentação.
- Medidos os tempos de referência da Etapa 1 e adicionado o [coletor offline](mes-s7-piloto/docs/DESEMPENHO_PILOTO_12.md).

## Revisão documental 02 — 23/11/2026

- Criada a skill [piloto-evolucao-processos v0.1.0](.agents/skills/piloto-evolucao-processos/SKILL.md).
- Mapeadas as regras implementadas de Transporte e os consumidores diretos dos principais módulos compartilhados.
- Registrados Recebimento e Dosagem como pendentes de levantamento.
- Atualizados o [manual](MANUAL_OPERACAO.md) e as [instruções do projeto](AGENTS.md).
