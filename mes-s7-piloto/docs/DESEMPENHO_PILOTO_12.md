# Tempo dos testes do Piloto-12 — Etapa 1

## Referência e amostra

- Checkout de referência `89b1dc7` (**Piloto-12**). Antes do trabalho, o índice já continha a exclusão de `mes-s7-piloto/execucao.exemplo.json`.
- Lote `Teste_rotas_Rev00_2026-11-23-17-26-17-426`, em modo MES + S7. O log informa a versão, sem identificar o commit executado na VM.
- Corte no 17º resultado persistido, às 17h31min32s de 23/11/2026 (São Paulo). Das 93 rotas selecionadas, o recorte tem 15 aprovações e duas falhas de partida (703 e 704). A rota aprovada teve mediana de 19,51 s, P90 de 20,59 s e máximo de 21,48 s até o encaminhamento ao registro. As falhas duraram 7,67 s e 8,07 s.
- O lote anterior identificado como `11` registrou 174 de 265 resultados. Esses lotes têm seleções diferentes e ambos os recortes são parciais. Eles não formam uma comparação de desempenho antes/depois.

## Medições por etapa

Tempos em segundos. P90 usa a posição de ordem `ceil(0,90 × n)`. Os cortes por eventos incluem o trabalho executado entre os marcadores, inclusive a fila do Cypress e o diário. As linhas de preparação e busca se sobrepõem. As medianas de fases não são aditivas.

| Etapa | n | Mediana | P90 | O que foi medido |
| --- | ---: | ---: | ---: | --- |
| Login e acesso | 1 | 2,46 | 2,46 | Cronômetro do fluxo até `/home`. A pré-validação inicial ocorre antes dele. |
| Disponibilidade do cartão / campo | 1 cada | 0,01 / 0,06 | 0,01 / 0,06 | Cronômetros da navegação do lote. |
| Preparação da rota | 15 | 3,92 | 4,48 | Selecionar local até verificar **Iniciar**. Inclui busca e preparação S7. A validação inicial da linha da LIR está fora desse intervalo. |
| Busca por rota | 15 | 1,22 | 1,77 | Soma dos tempos de preencher, localizar e selecionar. Foram 60 buscas em rotas aprovadas e zero tentativas adicionais. |
| Preparação S7 | 15 | 1,78 | 1,83 | De `Preparar leitura S7` a `Verificar botão Iniciar`. Inclui SQL, mapeamento, Monitor e espera de amostra. |
| Partida habilitada | 15 | 0,22 | 0,25 | Da verificação de **Iniciar** ao início do acompanhamento S7. Inclui verificação e clique. |
| Retornos S7 e evidências iniciais | 15 | 2,19 | 3,26 | Do início da etapa de acompanhamento S7 até a etapa de confirmação do cartão. |
| Amostra de confirmação do S7 | 15 | 1,08 | 2,12 | Relógio da evidência S7, da primeira consulta do acompanhamento até a amostra que confirmou os retornos. |
| Confirmação **Iniciado** no MES | 15 | 0,05 | 0,55 | Cronômetro após observar os retornos S7. |
| Captura inicial do supervisório | 14 | 0,48 | 0,54 | Do marcador de captura ao início do acionamento de nível alto. |
| Acionamento da LSH | 14 | 0,08 | 0,13 | Entre o marcador de acionamento e a espera por nível alto. |
| Nível alto até a confirmação conjunta | 14 | 6,48 | 7,45 | Da abertura da operação de escrita ao registro da confirmação no CLP e MES, pela evidência S7. |
| Primeira amostra positiva de `Alm` ou `Aviso` e DB11 | 14 cada | 5,34 | 5,34 | Ambos apareceram na mesma amostra nas 14 rotas. A cadência de leitura limita a precisão do instante em que o CLP mudou. |
| Da primeira amostra positiva à confirmação conjunta | 14 | 1,20 | 2,12 | Diferença calculada por rota. Pode incluir atualização do MES, consulta e validação final. |
| Evidências após confirmar nível alto | 14 | 2,05 | 2,08 | Do registro da reação ao início da restauração. Inclui renderização, capturas e fila de comandos. |
| Restauração da LSH | 14 | 0,09 | 0,13 | Do início da restauração ao marcador de finalização no MES. |
| Parada e encerramento no MES | 15 | 3,71 | 4,75 | Cronômetro de finalização até a confirmação final, máximo de 7,67 s. |
| Limpeza isolada | 0 | — | — | O log não delimita o clique, a confirmação e a liberação como intervalo próprio. A limpeza normal, quando ocorre, integra o encerramento. |
| Persistência | 17 | 0,29 | 0,32 | Do evento `resultado-recebido` ao `resultado-persistido`. Inclui histórico XLSX, atualização e validação da LIR. |

## O que os números permitem propor

1. **Evidências e renderização (T03, T05, T08).** O intervalo de evidências após nível alto é de 2,05 s de mediana. O código renderiza a primeira página para obter o total e a renderiza de novo no laço de capturas. A próxima medição pode isolar renderização, screenshot e captura de desktop. Se o segundo render se provar redundante, avaliar reaproveitar apenas a página já renderizada do mesmo resultado, invalidada por nova amostra, página ou desmontagem do painel. A quantidade e o conteúdo das evidências são critérios de equivalência.
2. **Preparação S7 (T03, T05).** Dos 3,92 s da preparação, 1,78 s corresponde ao intervalo de preparação S7. Falta separar consulta de vínculos, consulta do silo, cálculo do mapeamento, conexão e primeira leitura válida. A fonte mostra consultas SQL separadas. Só após medir cada parte, avaliar reaproveitar uma conexão dentro da mesma preparação, com consultas executadas novamente na rota corrente e sem guardar estado operacional para a próxima.
3. **Espera por condição e encerramento (T02–T07).** Nível alto e encerramento são os maiores intervalos, mas contêm condições do processo. A primeira amostra positiva de nível alto só chegou por volta de 5,34 s. Os 1,20 s seguintes misturam atualização do MES e cadência de consulta. A preparação do botão desabilitado tem uma janela funcional de 4 s com reconsultas de 250 ms. O código também consulta por condição na busca e na leitura MES/S7. A configuração local observada tem as três esperas adicionais em zero e consulta S7 de 1.000 ms. Os valores dessa configuração não são registrados no lote. Ainda faltam contagens de consultas e horários separados de parada, diálogo, limpeza e local vazio. Preservar os prazos e as condições.
4. **Persistência (T08).** A mediana de 0,29 s foi pequena neste recorte. O código reabre o histórico e confere a LIR antes e depois de gravar. São pontos mensuráveis, mas checagens de hash, XML, backup e confirmação de gravação protegem a recuperação e devem permanecer. As 60 buscas da amostra também não indicam retrabalho de seleção, então busca e persistência ficam atrás das evidências na ordem de investigação.

Nenhuma redução de tempo foi medida. Antes de escolher a primeira mudança, medir o trecho candidato com marcadores locais de início e fim ou com o Command Log quando disponível. Para leituras repetidas, contar por operação, rota e amostra sem registrar payload, credenciais ou valores do CLP. Para limpeza, medir desde a ação autorizada até a confirmação de local vazio e manter a confirmação da parada como marco independente.

## Validação no lote anterior

O coletor foi executado no lote `Teste_rotas_Rev00_2026-11-23-16-20-24-127`, registrado como Piloto `11`. O último evento disponível é de 17h26min03s de 23/11/2026 (São Paulo). O registro contém **174 resultados persistidos de 265 selecionados**, com 172 aprovações e duas falhas. O restante da seleção fica fora do recorte.

| Etapa | n | Mediana (s) | P90 (s) |
| --- | ---: | ---: | ---: |
| Rota aprovada | 172 | 22,25 | 23,37 |
| Preparação da rota | 172 | 5,16 | 5,89 |
| Busca por rota | 172 | 1,74 | 2,29 |
| Preparação S7 | 172 | 1,95 | 2,02 |
| Retornos S7 e evidências iniciais | 172 | 3,66 | 3,79 |
| Confirmação **Iniciado** no MES | 172 | 0,03 | 0,03 |
| Nível alto até a confirmação conjunta | 171 | 5,97 | 7,07 |
| Evidências após confirmar nível alto | 171 | 2,77 | 2,97 |
| Parada e encerramento no MES | 172 | 2,73 | 3,76 |
| Persistência | 174 | 0,30 | 0,33 |

O login e acesso levaram 3,81 s nesse lote. As 688 buscas das rotas aprovadas ocorreram sem tentativas adicionais registradas. A primeira amostra positiva de `Alm` ou `Aviso` e a primeira amostra positiva do DB11 tiveram mediana de 5,69 s. O intervalo calculado por rota da primeira amostra digital positiva à confirmação conjunta teve mediana de 1,26 s. Limpeza continua sem um cronômetro isolado.

A amostra maior sustenta a prioridade de **separar renderização e captura de evidências** (T03, T05, T08). A preparação S7 é o próximo trecho a decompor. As rotas e condições dos dois lotes são diferentes, e o intervalo de evidências inclui várias operações. Os valores observados ainda não demonstram economia com a remoção de uma renderização nem ganho entre versões.

Reprodução offline a partir de `mes-s7-piloto`:

```powershell
node scripts/medir-tempos.cjs Teste_rotas_Rev00_2026-11-23-16-20-24-127
```

## Execução controlada e coleta

1. Na VM de simulação, prepare uma cópia de trabalho com uma cópia da LIR e as configurações locais autorizadas. Selecione uma rota por vez pelo `codigoRota` de `s7.local.json`. Use a mesma revisão, estado inicial do MES/CLP, rota, modo de busca, captura e cadência do Monitor em cada repetição. Compare pares equivalentes, com pelo menos três execuções por cenário, identificando sucesso, falha e recuperação. Para recuperação, siga a seção 10 do [manual](../../MANUAL_OPERACAO.md).
2. O operador executa o spec na máquina da bancada. O comando abaixo **aciona o fluxo normal** no ambiente configurado.

   ```powershell
   Set-Location .\mes-s7-piloto
   npm.cmd run executar -- --spec "testes/transferencias/transferencias.cy.js"
   ```

3. Após o encerramento do lote, gere a medição offline pelo nome da pasta. O segundo argumento opcional encerra o recorte no N-ésimo resultado persistido e permite reproduzir esta referência.

   ```powershell
   node scripts/medir-tempos.cjs Teste_rotas_Rev00_2026-11-23-17-26-17-426 17
   ```

O coletor lê somente os eventos e a última evidência S7 correspondente a cada rota aprovada e persistida, omite evidências que não podem ser atribuídas a uma tentativa única e imprime agregados no terminal. Ele não modifica o lote nem inicia serviços. As métricas em nível de rota descrevem tentativas registradas, e os tempos de login e navegação aparecem uma única vez por relatório.

## Alterações e reversão

Esta etapa acrescenta o coletor offline e esta referência, com rastreabilidade nas regras T01–T08 da [matriz de processos](../../.agents/skills/piloto-evolucao-processos/references/matriz-processos.md). A validação desta entrega é leitura de evidências e teste do coletor. A execução funcional e os resultados de bancada permanecem fora da alteração. Para reverter, remova somente o coletor e os registros documentais desta etapa. Nenhuma configuração local ou resultado precisa ser restaurado.
