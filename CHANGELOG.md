# Changelog

- Adotado o nome Nexxus Validação de Processos no README e no manual. Piloto-12 permanece como identificador interno para versionamento e evidências.

- Recebimento passou a registrar a entrega confirmada por SQL no diário de evidências, com origem, OR, item, produto, destino e peso. Documentada a regra R08 e atualizada a skill piloto-evolucao-processos para 0.7.0.

- Organizadas as regressões locais em `mes-s7-piloto/regressao/`. O manual explica a descoberta e a execução, e a skill piloto-evolucao-processos 0.6.0 adota a pasta como padrão.

- A Transferência identifica origem com estoque zero antes da partida e registra o motivo na LIR e no histórico.

- O cadastro de OR de Ensacados reutiliza o fluxo completo e marca Ensacados antes de liberar o cabeçalho.

- Adicionados os specs iniciais de cadastro e Recebimento de Ensacados com login reaproveitado. A primeira validação em bancada cobre apenas a abertura das telas e a opção Ensacados.

## Revisão documental 06 — 25/11/2026

- Removidos o manual visual e os relatórios da Rev04, junto com os dois arquivos rotulados como Python. Os procedimentos atuais estão no manual de operação e o histórico permanece no Git.

- Atualizada a skill piloto-evolucao-processos para 0.4.0, com roteiro local das skills Cypress e validação por regra.
- Revisados manual, README e matriz para Transporte com conferência de estoque e Recebimento de Grãos, Líquidos e Ensacados. Registrados os candidatos à limpeza e a cobertura complementar da regressão.

## Revisão documental — Skills do Piloto (24/11/2026)

- Atualizada a skill piloto-evolucao-processos para 0.3.0 com roteiro de reaproveitamento e regras R01–R05 de Recebimento. A retomada em bancada e o levantamento de Dosagem seguem pendentes.

## Piloto-12 — Recebimento Grãos RG (24/11/2026)

- Renomeada a spec de Recebimento para recebimento.js nas configurações principal e dedicada do Cypress.
- Incluído cenário de óleo na spec de ordens e de Recebimento. Modalidade e rota são dados de configuração, e a LIR fornece origem, destino e LSH.
- O Recebimento passou a recuperar a mesma OR ativa antes de tentar nova partida, preservando a ordem e respeitando pendência de LSH.
- Milho e farelo passaram a rodar como testes independentes no mesmo spec. OR indisponível interrompe apenas o cenário antes de Iniciar.
- Após confirmar a parada, o Recebimento aceita o painel vazio confirmado quando o cartão sai rapidamente de Parando e mantém a verificação da restauração.
- O ciclo completo de Recebimento passou a usar a ordem gerada, a rota e o cartão do primeiro cenário de pré-partida.
- Adicionada pré-partida por cenário com leitura das ordens confirmadas e das rotas da LIR, sem iniciar operações.
- O cadastro de ordens passou a ler cenários de produtos e registrar o item e a confirmação na listagem no JSONL.
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
