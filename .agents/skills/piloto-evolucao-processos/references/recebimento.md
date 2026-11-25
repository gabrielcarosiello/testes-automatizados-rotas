# Preparação do Recebimento

## Estado atual no Piloto-12

Ciclo de Grãos RG e reconhecimento pelo SQL de OR já recebida foram validados na VM para milho em MG01 e farelo em RG08. A retomada da mesma OR ativa com resposta Não foi coberta localmente e ainda aguarda validação na VM. Consulte a [matriz atual](matriz-processos.md) e o [roteiro de reaproveitamento](reaproveitamento.md). Óleo de soja usa a mesma spec de Granel. O operador confirmou a seleção da aba de Líquidos e o reconhecimento de uma OR já recebida. Em Ensacados, o operador confirmou o recebimento por OR. A spec verifica o movimento de estoque associado à ordem e ao produto, com evidência própria. As seções de levantamento abaixo preservam o contexto histórico.

## Referência e diagnóstico inicial (histórico)

Base analisada em 24/11/2026: Piloto-12, HEAD `1cae9ac`, branch `piloto-12`, árvore limpa e um commit à frente de `origin/piloto-12` na conferência inicial. O README, a seção 16 do manual e a matriz registram Recebimento como pendente. Na base documental analisada, a busca direcionada não encontrou um fluxo de Recebimento definido. A conferência posterior na tela está registrada abaixo.

O [Cypress](../../../../mes-s7-piloto/cypress.config.js) seleciona a LIR de Transporte, registra as tarefas Rev 00/S7 no Node e expõe `catalogoRev00` ao [spec de transferências](../../../../mes-s7-piloto/testes/transferencias/transferencias.cy.js). Hoje o `specPattern` abrangente pode descobrir qualquer novo `.cy.js` sob `testes/`, enquanto o carregamento seleciona configuração de Transporte. A [orquestração](../../../../mes-s7-piloto/testes/transferencias/rotas-transferencias.js) preserva a sessão com `testIsolation: false`. Login e navegação precedem as rotas. O estado em memória liga os testes, e os hooks registram o resultado e tratam pendências e recuperação. Rodar apenas o teste de uma rota pode pular a preparação necessária.


## Conferência no MES em 24/11/2026

**Observado na interface.** O acesso autenticado por **Movimentação → Receber Granel** mostrou oito abas, com **Recebimento Grãos RG** selecionada inicialmente.

| Modalidades exibidas |
| --- |
| Recebimento Grãos RG |
| Recebimento Origem Animal OA |
| Recebimento Minerais MI |
| Recebimento Premix PX |
| Recebimento Liquidos UT |
| Recebimento Farelo RF |
| Recebimento UT18 |
| Recebimento Manual Liquidos |

Na aba Grãos RG, foram observados os campos **Recebimento**, **Ordem Recebimento**, **Destino** e **Rota**. Com o formulário vazio, **Iniciar**, **Destinos alternativos** e **Condições** estavam desabilitados. A área **Recebimentos em uso** indicava que não havia recebimento em uso.

**Requisitos confirmados pelo responsável.** O teste usa uma Ordem de Recebimento preparada previamente. A seleção segue Recebimento → Ordem de Recebimento → Destino → Rota quando houver mais de uma opção para o destino. O botão **Condições** serve para conferir a condição da operação. O fluxo também prevê Limpar, Destinos alternativos e Iniciar. O comportamento desses controles com o formulário preenchido ainda precisa ser observado. Nenhuma ordem foi selecionada ou alterada durante a conferência.

**Primeiro recorte proposto.** Validar uma única modalidade. Grãos RG é candidata por ter sido a aba inicial observada. Com uma ordem autorizada, confirmar os dados visíveis, o preenchimento, a necessidade de escolher rota e a habilitação dos controles, sem iniciar a operação nesse primeiro recorte. Para validar o ciclo completo, ainda faltam as regras de condições de partida, pesagem e nível alto quando aplicáveis, os retornos S7, o encerramento e os registros esperados.


## Destino indisponível antes da partida

O responsável relatou que o destino esperado não pôde ser selecionado. A hipótese é incompatibilidade entre o produto da ordem e o produto já armazenado no silo. A indisponibilidade do destino, por si só, não confirma o motivo.

Para validar, identificar a ordem e o silo esperado, registrar se o destino está ausente ou desabilitado no MES e comparar o produto da ordem com o produto cadastrado e o estoque do silo. Consultar o cadastro por leitura, quando disponível, e registrar a mensagem ou condição de bloqueio exibida. Um caso com produto compatível, em condições equivalentes, ajuda a confirmar o critério. Preservar os dados da ordem e do silo durante a conferência. A hipótese permanece pendente antes de virar critério do teste.

### Ordem 9390 — conferência de pré-partida

No MES, na modalidade **Recebimento Grãos RG**, foi possível selecionar a ordem **9390**, o destino **MG01** e a rota **RG01 → RG03 → RG04 → RG22 → MG01**. Ao concluir a seleção, **Iniciar** e **Condições** estavam habilitados. O controle Condições foi acionado para consulta, sem confirmação do conteúdo exibido nesta inspeção. O recebimento não foi iniciado. O caso comprova que MG01 foi selecionável com a ordem 9390. Segundo o responsável, a ordem de óleo de soja estava na modalidade incorreta. Ela deve ser processada em **Recebimento de Líquidos**, e a comparação com a ordem 9390 em Grãos RG não comprova bloqueio por produto já armazenado no silo.

## Encerramento e destinos alternativos

O responsável confirmou duas formas de encerramento do Recebimento:

1. **Nível alto do silo.** O recebimento pode encerrar quando o silo de destino atinge nível alto. É possível ensaiar mais de um silo com **Destinos alternativos**. Registrar o destino associado a cada evidência de nível alto e confirmar como o MES indica a troca de destino ou o encerramento da ordem.
2. **Parada e limpeza.** Solicitar **Parar**, aguardar a confirmação da parada e só então usar **Limpar**. Conferir o estado final no MES e os registros correspondentes antes de liberar outra execução.

Os destinos alternativos são configurados antes de **Iniciar**. Quando essa configuração é feita previamente, o MES realiza a troca de destino automaticamente. Se ela não for feita antes da partida, pode ser necessário trocar o destino manualmente. O cenário recomendado deve configurar os destinos antes da partida e verificar no MES que o destino atual mudou para o silo esperado, registrando a evidência por silo. A troca manual é um cenário distinto a validar posteriormente.

Ainda falta confirmar os estados exatos no MES e em `dbo.Recebimento`, o estado final após o último destino e se os resultados de vários silos devem ser gravados em uma única linha ou separadamente. O teste deve registrar a confirmação de restauração da LSH quando houver atuação e a condição que comprova a liberação para o próximo recebimento.

## Nível alto, planilha e validação SQL

- **Nível alto é aplicável ao Recebimento.** Para definir a aprovação, confirmar o vínculo entre ordem, destino e sinal, a condição esperada no MES e S7 e a restauração após o ensaio. A regra T05 descreve Transporte e serve de referência para a investigação.
- **A planilha precisa registrar o Recebimento.** Confirmar o arquivo ou modelo e a chave da linha, além das colunas de resultado, nível alto e falha. Validar a escrita primeiro em cópia de teste.
- **dbo.Recebimento** é a fonte SQL indicada para conferir o Recebimento. Confirmar por leitura as chaves, campos de estado e vínculos com ordem, destino e rota, e identificar quais dados continuam vindo do MES ou do S7. O SQL Server recusou a autenticação integrada desta estação com código 18452, então as colunas e os estados seguem pendentes de comprovação.
- **Elevação de versão.** A entrega que habilitar Recebimento precisa de revisão funcional, regressão do Transporte e atualização dos identificadores de versão e do changelog. O número alvo e o momento da elevação aguardam definição. A revisão de levantamento permanece identificada como Piloto-12.
## Matriz de compartilhamento

Caminhos relativos a `mes-s7-piloto/`. Consumidores e cobertura indicam evidências por leitura de código. Os IDs T01–T08 continuam sendo do Transporte. As letras A–E são classes, e C/E indica uma regra específica com recurso de acesso restrito.

| Classe e recurso | Responsabilidade e consumidor atual | Regra e estado | Condição para Recebimento, isolamento e impacto no Transporte | Cobertura existente e lacuna |
| --- | --- | --- | --- | --- |
| A — `comum/s7/cliente-monitor.js` | Cliente HTTP usado por `comum/s7/piloto.js` e `scripts/diagnosticar.cjs`. | T03, T06. Reutilizável como código. | Usar o contrato atual em instância própria. Configuração de endpoint exige confirmação. A sessão e o mapeamento do Monitor exigem uso exclusivo quando a bancada for a mesma. Troca de sessão pode invalidar releitura do Transporte. | `cliente-monitor.test.js`. Cobrir sessão expirada e comandos sem resposta no serviço consumidor que vier a ser definido. |
| A — `comum/execucao.js`, `comum/credenciais-mes.js` | Leitura de opções e credenciais em `cypress.config.js`. | T01. Reutilizável como código nos formatos compatíveis. | Configuração por processo e execução. Credencial pode ser usada só no ambiente autorizado, sem exposição em artefatos. O esquema atual da execução tem campos de Transporte. Adaptador futuro deve ficar no processo consumidor. | `execucao.test.js`, `credenciais-mes.test.js`, `configuracao-real.test.js`. Cobrir carga independente e ausência de segredo exposto. |
| A/E — `comum/registro-execucao.js`, `cypress.base.config.js` | Diário chamado pelo piloto e pela configuração de Transporte. Tarefa de captura de tela registrada no Node. | T08. Código reutilizável e artefatos restritos. | Pasta e identificação próprias por processo/lote. Confirmar contrato da captura e separar o vocabulário de falhas. Evitar colisão de arquivos ou mistura de eventos e relatórios. | `registro-persistencia.test.js`, `resumo-execucao.test.js`. Verificar a separação em lotes distintos e falha durante gravação. |
| B pendente — `cartoes-mes.js`, `consultas-mes.js`, `limpar-transferencia.js`, `recuperar-encerramento.js` em `comum/` | Leitura do cartão, comandos e recuperação chamados pelo Transporte e seus helpers. | T02, T04, T07. Candidatos, sem equivalência comprovada com Recebimento. | Comparar identidade da operação, pré-condições, resultados e recuperação antes de compartilhar qualquer regra. Um seletor parecido não comprova autorização para encerrar. Manter o cartão e a identificação no contexto do processo. | `cartoes-mes.test.js`, `limpar-transferencia.test.js`, `recuperar-encerramento.test.js`. Exigir evidência do Recebimento e regressão de ambiguidade e cartão incorreto. |
| C — `testes/transferencias/`, `comum/s7/consultarRota.js`, `comum/s7/nivel-alto.js` e `comum/nivel-alto-mes.js` | A orquestração, o piloto S7 e a configuração usam seleção, permissivos observados, sinais e critérios de Transporte. | T01–T08. Específico no uso atual. | Manter seleção da LIR, vínculos de rota, DB11, polaridade, confirmação MES e recuperação no domínio atual. SQL do Recebimento depende de levantamento. | `selecao-lir.test.js`, `recusa-partida.test.js`, `nivel-alto.test.js`, `piloto.test.js`. Cobrir regras do novo processo com exemplos próprios quando confirmadas. |
| D — Regras de Recebimento | Fluxo, entradas, saídas e recuperação ainda sem consumidor comprovado nas fontes revisadas. | Sem IDs nesta etapa. Pendente. | Definir a partir do processo real e usar as perguntas abaixo. Proposta de IDs `R01`, `R02` e seguintes após a confirmação de cada regra. | Especificar cenário nominal, validações negativas e recuperação após levantamento. |
| E — `comum/s7/piloto.js`, `comum/s7/estado-escrita.js`, sessão MES/Monitor e atuação | O piloto cria contexto mutável, guarda proprietário e usa a pendência de escrita como bloqueio de segurança. O spec mantém a sessão e o estado da rota. | T03–T07. Restrito à instância e à operação proprietária. | Cada processo precisa de contexto próprio. Acesso à mesma bancada é serializado e exige conferir a operação e qualquer pendência existente. Uma pasta separada não pode ocultar restauração pendente na mesma CPU/sessão. Somente a operação proprietária pode comandar/restaurar pelo fluxo aplicável. | `estado-escrita.test.js`, `nivel-alto.test.js`, integração simulada. Cobrir troca de processo, troca de sessão, pendência anterior e ausência de reenvio. |
| E — `testes/transferencias/lir-rotas.js`, `comum/gravar-lir.js`, resultados e configuração local | As tarefas Rev 00 atualizam a LIR de Transporte; a rotina Node protege a gravação e os backups. | T01, T08. Planilha e histórico restritos ao processo e lote. | Definir planilha e cabeçalhos próprios antes de mapear dados. Escrita exclusiva, resultados distintos e nenhuma reutilização da LIR operacional do Transporte como destino. | `lir-rotas.test.js`, `planilha-xml.test.js`, `registro-persistencia.test.js`. Cobrir separação de planilhas, lock, recuperação e preservação de dados. |

Reutilizar código significa chamar um contrato técnico compatível. Compartilhar configuração exige confirmar esquema e destino. Compartilhar estado exige propriedade explícita e recuperação verificável. Compartilhar acesso à bancada exige serialização e transferência segura do controle. Esses quatro pontos são decisões independentes.

## Organização proposta e primeiro cenário

- Após o levantamento, criar o módulo E2E em `testes/recebimento/`, com entrada, tarefas e fixtures próprias. Manter a configuração de Transporte intacta. A proposta é selecionar Recebimento explicitamente com uma configuração própria, fora da descoberta padrão do Transporte. Antes de introduzir um `.cy.js`, demonstrar que o comando atual do Transporte mantém exatamente os mesmos specs e tarefas.
- Preparar o cenário em uma operação completa com identidade própria e estado inicial conhecido. Usar uma ordem de teste autorizada, um produto, uma origem, um destino e uma rota confirmados. Executar a modalidade mais simples aprovada pelo responsável, até o estado final do MES e a confirmação de bancada livre. O nível alto é aplicável e depende de critérios confirmados. A pesagem será incluída conforme a modalidade escolhida. Sinais, tolerâncias, estados, evidências e recuperação permanecem pendentes.
- Caso surja mudança em serviço compartilhado, abrir proposta separada com consumidores, risco, teste de equivalência e regressão do Transporte. Na implementação futura, validar os contratos com testes isolados e integração simulada. Em seguida, planejar na bancada autorizada um caso nominal, um impedimento e uma recuperação. Conferir no Transporte seleção, tarefas, cartão correto, pendência, LIR e evidência.

## Perguntas para fechar o primeiro cenário

1. **Escopo e entrada.** Grãos RG pode ser a primeira modalidade? Qual ordem preparada podemos usar, com o produto, a origem e o destino esperados? Esse destino oferece uma ou várias rotas?
2. **Confirmações.** Nessa modalidade, a pesagem é obrigatória, opcional ou não se aplica? Quais sinais e estados confirmam o nível alto? Qual a sequência, tolerância e condição de aceitação da pesagem, se houver? Qual fonte SQL vincula a ordem à rota, e quais permissivos, comandos, equipamentos e retornos S7 confirmam cada etapa?
3. **Conclusão e recuperação.** Quais estados do MES confirmam sucesso, interrupção e cancelamento? Como recuperar uma execução incompleta, quais sinais devem voltar ao normal e o que autoriza a próxima execução?
4. **Registro.** Qual é a LIR ou modelo do Recebimento, e quais campos, histórico e evidências são obrigatórios para sucesso e falha?

Registrar respostas e fontes nesta referência antes de atribuir IDs ou implementar. As partes ainda não comprovadas ficam pendentes.

## Registro editorial

Revisão 05, skill 0.2.0. `SKILL.md` concentra o procedimento e o isolamento. `matriz-processos.md` aponta para este levantamento e preserva T01–T08. Esta referência documenta classificação, impacto, cobertura e questões em aberto. `README.md`, `MANUAL_OPERACAO.md` e `CHANGELOG.md` registram a revisão e seus atalhos.

Revisão estrutural orientada por `cypress-explain` e proposta de organização orientada por `cypress-author`. A consulta `cypress-docs` fica reservada para dúvidas de API ou comportamento que o código não responda. Nenhuma sessão `cypress-tap` foi necessária. As conclusões são documentais e não constituem validação do Recebimento.


## Evolução do ensaio da ordem 9390

A execução no Cypress confirmou a seleção de MG01 e da rota. Nessa execução o botão **Condições** não apareceu após a seleção, e o spec parou nessa asserção. A pré-partida passa a verificar a rota e o botão **Iniciar**.

O cenário operacional deve começar a observar os retornos dos equipamentos na partida. Após confirmá-los, o mesmo cenário pode ensaiar a LSH de MG01 e verificar se o MES encaminha o recebimento para finalização por nível alto. O **Sim** deve ser acionado somente em uma confirmação de recebimento identificada no contexto da ordem testada. Registrar a restauração da LSH e o encerramento confirmado antes de liberar outro teste.

O vínculo SQL entre a ordem, a rota e os equipamentos e os textos dos pop-ups ainda requerem evidência. O código de rota de Transporte e os seletores de seus cartões não foram adotados como referência para atuar no Recebimento.


## Preparação do próximo lote e criação de ordens

### Formulário de criação confirmado na VM

Caminho no MES — Movimentação → Ordem Recebimento → Adicionar.

- A tela abre com Recebimento 0, data, Código|Lote, Placa e o botão Liberar. Ensacados e Ajustar Ensacado aparecem desmarcados no cenário Grãos RG.
- A grade Itens da Ordem de Recebimento abre vazia. Adicionar, Finalizar e Duplicar Item aparecem desabilitados antes da liberação.
- A seção Pesos apresenta Pesagem Completa, Bruto, Tara, Líquido e Confirmar. A captura inicial não estabelece quais pesagens ou campos são obrigatórios para liberar a ordem de Grãos RG.
- Na primeira criação, observar os campos exigidos pelo MES ao liberar o cabeçalho. Anotar o número gerado e o momento em que Adicionar é habilitado. Na inclusão do item, conferir o produto 2, a unidade, a quantidade 1 e o peso de referência 1000. Confirmar a disponibilidade da ordem no seletor Receber Granel antes de repetir para as outras quatro.
- O cadastro da ordem pode ser validado pelo cabeçalho e item no SQL. A associação à rota e ao destino é uma etapa separada, conferida na LIR e no seletor do MES.


O item das ordens 9389 e 9390 foi cadastrado com produto 2 (Milho CG Moído 34130CP|GR), quantidade 1, peso unitário e total de 1000 e fornecedor nulo. As duas ordens constam na situação 4 após a finalização. A ordem 9390 já foi observada na situação 2 quando disponível. Esses valores são referência da bancada. Confirmar os campos obrigatórios e as unidades no formulário de criação antes de automatizar.

| Ordem de teste | Modalidade | Destino | ID SQL da rota | Caminho cadastrado no SQL |
| --- | --- | --- | --- | --- |
| 1 | Grãos RG | MG01 | 14 | RG01 → RG03 → RG04 → RG22 → MG01 |
| 2 | Grãos RG | RG08 | 1 | RG01 → RG03 → RG04 → RG06 → RG08 |
| 3 | Grãos RG | RG16 | 4 | RG01 → RG03 → RG04 → RG06 → RG16 |
| 4 | Grãos RG | RG32 | 5 | RG01 → RG03 → RG04 → RG06 → RG31 → RG34 → RG32 |
| 5 | Grãos RG | RG37 | 6 | RG01 → RG03 → RG04 → RG06 → RG31 → RG34 → RG37 |

Os cinco destinos tinham o produto 2 e não estavam marcados com bloqueio de carga na consulta SQL. O MES ainda precisa confirmar cada opção no momento da partida. Os caminhos das rotas 1, 4, 5 e 6 divergem dos textos históricos na LIR e precisam ser reconciliados por ID antes de executar o lote. A coluna Ordem de Recebimento deve receber somente IDs gerados e confirmados no MES.

1. Validar a criação pelo MES da VM. Registrar a tela, a modalidade, os campos obrigatórios, o produto, a quantidade, os pesos e o identificador da ordem criada. Confirmar cabeçalho e item em dbo.[Ordem.Recebimento] e dbo.[Ordem.Recebimento.Produto], além da disponibilidade no seletor de Grãos RG. Depois repetir para completar o lote de cinco ordens e registrar os IDs.
2. Adaptar lir-recebimento.js para carregar linhas elegíveis da aba de Recebimento. O cenário deve carregar modalidade, ordem e item, origem, destino, código e caminho da rota e a LSH aplicável. Usar a configuração compartilhada do Piloto.
3. Parametrizar o spec, o leitor do cartão, a tarefa S7 e a pasta de evidência com o cenário atual. Reutilizar consulta S7, capturas, confirmação dos dois diálogos, restauração e confirmação do painel livre.
4. Validar primeiro a rota 14 com uma nova ordem. Em seguida executar uma segunda rota com outro destino. Só então ampliar o lote e automatizar a criação e a atribuição das ordens. Conferir uma ordem nova, ordem já finalizada, produto incompatível e recuperação após falha. Uma confirmação de finalização consome a disponibilidade da ordem para nova execução.

## Dependências para Dosagem — Líquidos e MICRO

- Líquidos usa a spec de Recebimento existente, com o cadastro da OR, a seleção e a evidência do Granel. O SQL confirma Recebimento Líquidos UT (5) e o produto 6, Óleo de Soja, com código 56111CG|.
- A LIR associa RCP05 à rota 692, IBC → UT07 → UT10 → UT14. O caminho coincide com o SQL e UT14 estava vazio e sem bloqueio no levantamento. Confirmar no MES que a OR do produto 6 oferece esse tanque e essa rota. A conferência da linha 47 comprovou LSH_UT14 em M47 e ID 198 em N47. O cenário é configurável. A validação do operador no MES está registrada no estado atual.
- O MICRO já foi exercitado no Recebimento de Ensacados. Sua modalidade na Dosagem segue pendente. Premix usa dosagem de ensacados. Microdosagem usa silos de dosagem. Confirmar qual dos dois o MES usa para o insumo MICRO da fórmula escolhida antes de implementar a Dosagem correspondente.
- Dosagem permanece como [esboço](../../../../mes-s7-piloto/testes/dosagem/LEIA-ME.txt).
