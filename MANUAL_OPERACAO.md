# Manual de operação do Piloto MES e S7

**Piloto-12 · Monitor 0.13.0 · Revisão documental 06 · 25 de novembro de 2026**

Este manual orienta a preparação da bancada, a execução dos testes de Transporte e Recebimento e a conferência dos resultados. Também descreve como tratar falhas e recuperar operações interrompidas, preservando a LIR, as evidências e o estado de escrita no S7.

A revisão foi feita na branch `piloto-12-recebimento`. A versão funcional consta em `mes-s7-piloto/versao.json`. Consulte o [registro da auditoria Rev06](documentacao/AUDITORIA_PILOTO_Rev06.md).

> **Antes de iniciar:** confirme a CPU, a seleção de rotas, a planilha ativa e a ausência de pendências de restauração. Mantenha apenas uma execução por bancada MES/CLP.

## Índice

1. [Estrutura e documentos](#1-estrutura-e-arquivos-preservados)
2. [Preparação e instalação](#2-preparação-e-instalação)
3. [Configuração MES e SQL](#3-configuração-mes-e-sql)
4. [Configuração S7 e critérios](#4-configuração-s7-e-critérios)
5. [Planilha e seleção de rotas](#5-planilha-e-seleção-de-rotas)
6. [Operação do Monitor](#6-operar-o-monitor)
7. [Execução no Cypress](#7-executar-o-cypress)
8. [Etapas e critérios do teste](#8-etapas-e-critérios-do-teste)
9. [Resultados e integridade da LIR](#9-resultados-evidências-e-planilha)
10. [Recuperação de escrita pendente](#10-recuperar-escrita-pendente)
11. [Diagnóstico de erros](#11-diagnóstico-de-erros)
12. [Git e versionamento](#12-git-e-controle-de-versão)
13. [Configuração de outro projeto](#13-configurar-outro-projeto)
14. [Desempenho e regressão](#14-eficiência-manutenção-e-regressão)
15. [Histórico e limites da validação](#15-histórico-consolidado-e-limites)
16. [Evolução dos processos](#16-evolução-dos-processos)

<a id="1-estrutura-e-arquivos-preservados"></a>
## 1. Estrutura e documentos

Abra `mes-s7-piloto` como projeto Cypress. O Monitor é um serviço separado, na pasta `monitor-s7`. A raiz do repositório reúne a documentação e o verificador integrado.

| Caminho | Finalidade |
| --- | --- |
| `README.md` | Apresentação do projeto e acesso rápido aos documentos |
| `MANUAL_OPERACAO.md` | Procedimentos operacionais desta revisão |
| `mes-s7-piloto/cypress.config.js` | Configuração integrada e registro de tarefas |
| `mes-s7-piloto/testes/transferencias/` | Especificação, orquestração e regras do Transporte |
| `mes-s7-piloto/comum/` e `comum/s7/` | Serviços, persistência, catálogo, perfis e comunicação |
| `mes-s7-piloto/scripts/` | Diagnóstico, resumo, medição e recuperação de planilhas |
| `mes-s7-piloto/planilhas/` | Local da LIR operacional, fornecida pela instalação |
| `mes-s7-piloto/clp/System/PEData.plf` | Fonte TIA local, correspondente ao projeto da bancada |
| `mes-s7-piloto/resultados/` | Eventos, evidências, históricos, backups e controle persistente |
| `mes-s7-piloto/comum/fixtures/` | Planilhas de regressão; não usar como LIR operacional |
| `monitor-s7/` | Serviço HTTP, interface e driver S7 |
| `.agents/skills/piloto-evolucao-processos/` | Procedimento de evolução e matriz de processos |
| `verificar-tudo.cjs` | Regressão do Piloto, do Monitor e da integração simulada |
| `CHANGELOG.md` | Registro de versões e revisões documentais |

**Cópia do GitHub:** configurações locais, dependências, resultados, LIR operacional e projeto CLP podem ser excluídos pelo `.gitignore`. Preserve ou forneça esses recursos na instalação. Não substitua arquivos locais mais recentes por cópias históricas.

Os relatórios e manifestos antigos permanecem como registros de origem. A ausência de um arquivo histórico no checkout não impede o uso dos documentos atuais; consulte a origem indicada em cada registro.

<a id="2-preparação-e-instalação"></a>
## 2. Preparação e instalação

Use Windows com Node.js 22 ou superior e acesso aos serviços da bancada. A configuração precisa apontar para o MES, o SQL e a CPU de simulação corretos.

### Instalar as dependências

O **Node.js é instalado uma única vez no computador**. Nesta branch, Piloto e Monitor possuem seus próprios `package.json` e `package-lock.json`; as dependências são instaladas em cada subpasta. Não há um instalador npm na raiz.

No PowerShell, a partir da raiz do repositório:

```powershell
node --version
Set-Location .\mes-s7-piloto
npm.cmd ci
Set-Location ..\monitor-s7
npm.cmd ci
Set-Location ..
```

A instalação pode exigir internet ou caches do npm e do binário Cypress. O repositório não constitui um instalador offline completo. Esta entrega documental não recompila nem fornece um novo executável do Monitor.

### Preparar a instalação

1. Mantenha a versão anterior disponível para retorno.
2. Preserve a LIR atual, os resultados, as configurações locais e qualquer pendência de escrita.
3. Configure os arquivos MES/S7 e o SQL externo, conforme as seções seguintes.
4. Instale as dependências das duas subpastas.
5. Inicie o Monitor e faça o diagnóstico antes de selecionar um lote.

Na pasta `mes-s7-piloto`:

```powershell
npm.cmd run diagnostico
npm.cmd run diagnostico -- --monitor
```

O diagnóstico básico lê configurações, LIR e pendência em disco. A opção `--monitor` consulta o catálogo HTTP e verifica a disponibilidade da API de diagnóstico com uma lista vazia, sem abrir uma conexão com a CPU. Esses comandos não iniciam transferências, não escrevem no CLP e não validam a conexão SQL. A pré-validação do teste faz a consulta SQL de leitura.

<a id="3-configuração-mes-e-sql"></a>
## 3. Configuração MES e SQL

### Opções de execução

Configure `mes-s7-piloto/execucao.local.json`. Use JSON válido, sem comentários. Campos desconhecidos são recusados pelo carregador.

| Campo | Uso |
| --- | --- |
| `planilha` | Caminho da LIR dentro de `planilhas/`, por exemplo `planilhas/CL373.00.LIR.04.xlsx` |
| `urlMes` | Endereço do MES; a referência da bancada é `http://localhost/nexxus-mes` |
| `usuarioMes` | Nome do usuário selecionado no login |
| `selecaoRotas` | `pendentes`, `falhas`, `nao-testadas` ou `todas` |
| `modoBusca` | `estavel`: reconsulta entre caracteres; `rapida`: preenchimento integral, com verificação e alternativa estável |
| `capturaDesktop` | `true` mantém a captura desktop Windows; `false` mantém somente as capturas previstas pelo Cypress |
| `numTestsKeptInMemory` | Quantidade de testes mantidos em memória, de 0 a 50; referência: 5 |
| `esperaBuscaMs`, `esperaVisualS7Ms`, `esperaMesSemS7Ms` | Esperas adicionais entre 0 e 10000 ms; referência: 0 |

### Credenciais do MES

O carregador procura `credenciais.local.json` na raiz do projeto Cypress, ao lado de `cypress.config.js`. A chave é **`senhaMES`**, com essa capitalização. O valor abaixo é apenas um marcador:

```json
{
  "senhaMES": "SUBSTITUA_PELA_SENHA_LOCAL"
}
```

Uma senha já fornecida em `env.senhaMES` tem precedência. O carregador atual reconhece UTF-8 com ou sem BOM e UTF-16 com BOM. Mantenha credenciais fora dos commits, capturas e relatórios. Após alterar a configuração, recarregue o projeto no Cypress; reexecutar somente a spec pode manter os dados anteriores.

### Conexão SQL Server

O arquivo é externo ao projeto e pertence ao usuário Windows que executa o Cypress:

```text
%LOCALAPPDATA%\Nexxus\cypress-clp\sql.local.json
```

Se esse arquivo não existir, o módulo pode usar a pasta legada `CypressCLP`. Variáveis `FMS_SQL_*` do processo podem prevalecer sobre os valores do arquivo.

| Campo | Orientação |
| --- | --- |
| `server`, `database`, `user`, `password` | Servidor, banco e credenciais da instalação |
| `instance` | Instância nomeada, como `SQLEXPRESS` na referência da bancada |
| `port` | Opcional; quando explícita, a instância nomeada não é aplicada |
| `trustServerCertificate` | Booleano coerente com a política de certificado da instalação |
| `caFile` | Caminho da CA; quando relativo, é resolvido na pasta da configuração SQL |

A conexão utiliza `encrypt: true`. Na bancada que aceita certificado autoassinado, `trustServerCertificate: true` dispensa a CA. Essa escolha é da instalação; não deve ser transportada automaticamente para outro ambiente.

A consulta parametrizada cruza `dbo.[Rota.Segmento.Equipamento]` e `dbo.[Equipamento]`. O cadastro de silo usa `dbo.Silo`. O nome da rota, isoladamente, não identifica todos os equipamentos. Preserve o `cypress.config.js` integrado para manter os registros das tarefas.

<a id="4-configuração-s7-e-critérios"></a>
## 4. Configuração S7 e critérios

Configure `mes-s7-piloto/s7.local.json`. O arquivo local não é distribuído pelo Git. Se a mensagem de erro citar `s7.exemplo.json`, confira sua existência: esse modelo não está presente no checkout de referência desta revisão. Preserve a configuração anterior validada ou prepare uma configuração específica da bancada.

| Campo | Finalidade |
| --- | --- |
| `habilitado` | `true` para MES + S7; `false` para o fluxo MES |
| `codigoRota` | Número inteiro para uma rota específica; `null` para lote |
| `monitor` | URL HTTP local do Monitor, normalmente `http://127.0.0.1:3000` |
| `host`, `rack`, `slot` | CPU e parâmetros da conexão S7 |
| `pollMs` | Ciclo do Monitor; referência da bancada: 200 ms |
| `intervaloConsultaMs` | Consulta do piloto; referência: 1000 ms |
| `prazoS7Ms` | Prazo de confirmação S7; referência: 45000 ms |
| `peData` | Fonte TIA, normalmente `clp/System/PEData.plf` |
| `fonteCatalogo` | `automatico`, `monitor` ou `arquivo`, conforme o fluxo implementado |
| `catalogoId` | Catálogo explícito ou `null` |
| `modoValidacao` | `entradas` para retornos de posição; `sql` para seleção por perfil |
| `tipoContatoLSH` | `0` para NA; `1` para NF |
| `incluirLSHNoMonitor` | Inclui a LSH no mapeamento |
| `escritaManualLSH` | Habilita a permissão de escrita no ponto mapeado |
| `nivelAlto.habilitado` | Habilita o ensaio de nível alto nas rotas aplicáveis |
| `nivelAlto.prazoMs` | Prazo de confirmação; referência: 60000 ms |
| `nivelAlto.offsetsConfirmacao` | Offsets admitidos; referência do projeto: `1.0` e `1.1` |
| `nivelAlto.alarmesConfirmados` | Endereços explicitamente conferidos no projeto |
| `nivelAlto.rearmarRecusaPlcsim` | Opção explícita para o procedimento de rearme no PLCSIM; desativada por padrão |
| `camposDiagnosticoEquipamentos` | Nomes completos de campos adicionais do catálogo para diagnóstico |

A CPU `10.255.11.52`, rack 0 e slot 1 é uma referência da bancada anterior, não um padrão universal. Confirme esses dados antes de executar.

### Retornos e perfis

O SQL continua necessário no modo `entradas`, pois identifica os vínculos e comandos da rota. No modo `sql`, `perfis-s7.json` prioriza a regra por equipamento e depois por tipo. Comando 0 não participa dos retornos de acionamento; comandos 1 e 2 selecionam seus espelhos. Tipos sem regra válida falham explicitamente.

Gavetas com duplo solenoide podem ter saída pulsada. Confirme a posição pelo retorno de entrada quando esse for o critério do perfil; uma saída momentânea não comprova posição mantida.

### Polaridade da LSH

| `tipoContatoLSH` | Contato | Entrada em nível alto | Entrada normal |
| --- | --- | --- | --- |
| `0` | NA | `1 / true` | `0 / false` |
| `1` | NF | `0 / false` | `1 / true` |

No Monitor, **Aciona** escreve 1 e **Desaciona** escreve 0. Para contato NF, portanto, escrever 0 representa nível alto.

A aprovação do ensaio combina a entrada, **Alm OU Aviso** e a situação **Nível Alto** no MES. Não exige os dois bits digitais simultaneamente. Os offsets `1.0` e `1.1` pertencem ao layout de referência e precisam ser conferidos ao mudar de projeto. Não derive DB e offset apenas de um ID.

### Diagnóstico e rearme

O ponto `Silo[X].Niveis.Alto` do DB11 é diagnóstico. Seu mapeamento depende de cadastro SQL e layout coerentes; ele não substitui os critérios de aprovação. O diagnóstico de equipamentos usa os endereços confirmados no catálogo e diferencia valores lidos de condições não verificadas.

O rearme no PLCSIM exige habilitação explícita e guardas de estado. A normalização pode envolver uma escrita única ou nenhuma escrita quando os sinais já estão normais. Uma nova recusa encerra a tentativa sem novo rearme. Consulte o [registro de estabilidade](mes-s7-piloto/docs/PILOTO_11_ESTABILIDADE.md#rearme-após-recusa-de-partida-no-plcsim-60) antes de habilitar esse recurso.

<a id="5-planilha-e-seleção-de-rotas"></a>
## 5. Planilha e seleção de rotas

Mantenha a LIR operacional em `mes-s7-piloto/planilhas/` e indique seu caminho em `execucao.local.json`. Sem seleção explícita, a descoberta precisa encontrar um único candidato operacional. Arquivos temporários do Excel e fixtures de regressão não são a planilha de operação.

A aba usada pelo gravador é **Lista de Rotas - Transferências**. Preserve abas e cabeçalhos. O piloto verifica a identidade da linha e o status antes de gravar.

| Seleção com `codigoRota: null` | Rotas consideradas |
| --- | --- |
| `pendentes` | Teste NT/NOK e, quando habilitadas, pendências de nível alto aplicáveis |
| `falhas` | Teste NOK ou nível alto NOK aplicável |
| `nao-testadas` | Somente Teste NT |
| `todas` | Todas as rotas aplicáveis, inclusive as já aprovadas |

Use `codigoRota: 91` para um ensaio específico e `codigoRota: null` para voltar ao lote. Não use 0 ou string vazia como substituto de `null`.

Rotas sem IO/ID de nível alto, ou marcadas com `---` conforme as regras da LIR, podem manter o teste normal e registrar o ensaio de nível alto como não aplicável. Não crie endereços presumidos para preencher lacunas. Consulte os casos detalhados no registro de estabilidade.

Depois de mudar seleção, configuração ou planilha, recarregue o projeto para reconstruir o lote. O watcher fica desativado para evitar reinício involuntário durante a operação.

<a id="6-operar-o-monitor"></a>
## 6. Operação do Monitor

1. Execute `monitor-s7/INICIAR_MONITOR.cmd` ou, nessa pasta, `npm.cmd start`. Mantenha o serviço aberto durante o lote.
2. Acesse a URL exibida no terminal, normalmente `http://127.0.0.1:3000`.
3. Confira CPU, rack, slot e estado da conexão. Conectado sem tags indica negociação, não confirmação de leituras.
4. Abra um catálogo salvo correspondente ao projeto ou importe a pasta TIA com o PEData.
5. Pesquise por nome, palavras, DB ou endereço e combine os filtros de área, grupo e tipo.
6. Adicione os pontos e aplique o mapeamento. **Monitorar** e **Permitir escrita** são escolhas por ponto.
7. Use Cartões ou Tabela conforme a necessidade. O painel do piloto acompanha as tarefas e não depende de um iframe da interface completa.

Loopback é a máquina em que o serviço/navegador está em execução; não representa automaticamente o servidor MES. Um catálogo salvo não comprova a versão carregada na CPU nem restabelece a conexão por si só.

Os catálogos ficam em `%LOCALAPPDATA%/Nexxus/MonitorS7/catalogos`, salvo configuração de `MONITOR_S7_DATA_DIR`. A fonte PEData e o JSON extraído são persistidos por versão, não por consulta.

### Escrita e endereçamento

A escrita é pontual, com validação de sessão, qualidade, tipo, faixa, permissão e releitura. Ela não força a entrada ciclicamente; a CPU pode sobrescrever o valor. Para BOOL, os comandos são diretos; números usam editor inline. `acknowledged` sozinho não equivale a sinal estabilizado: confira `verified`, `observed` e a resposta do programa.

| Endereço no TIA | Sintaxe no Monitor | Interpretação |
| --- | --- | --- |
| `%I34.6` | `I34.6` | Entrada BOOL |
| `DB1149.DBX1.5` | `DB1149,X1.5` | Bit 5 do byte 1 |
| `DB5.DBW2` como INT | `DB5,INT2` | Inteiro no byte 2 |
| `DB5.DBD4` como REAL | `DB5,REAL4` | Real no byte 4 |

O catálogo PEData pode ser parcial. Confirme área, tipo e offsets no projeto, além das condições de acesso absoluto da CPU da bancada.

<a id="7-executar-o-cypress"></a>
## 7. Execução no Cypress

| Processo | Entrada no runner |
| --- | --- |
| Transporte | `transferencias.cy.js` |
| Cadastro de OR a Granel e Líquidos | `nova-ordem.ordem.js` |
| Cadastro de OR de Ensacados | `nova-ordem.ensacados.js` |
| Recebimento a Granel e Líquidos | `recebimento.js` |
| Recebimento de Ensacados | `recebimento-ensacados.js` |

Em Ensacados, o MES é acessado em **Movimentação → Receber Ensacado por Ordem de Recebimento**. O cenário identifica a OR e o produto, verifica se já existe movimento de estoque e, quando necessário, inicia e confirma o movimento por SQL. Em Granel e Líquidos, a spec acompanha o cartão no MES e os retornos S7 do cenário.

Na pasta `mes-s7-piloto`, execute `ABRIR_CYPRESS.cmd` ou:

```powershell
npm.cmd run abrir
```

Selecione E2E, o navegador e `testes/transferencias/transferencias.cy.js`. Confirme a identificação do piloto, o host e as rotas selecionadas antes do lote.

Para execução pelo terminal com navegador visível:

```powershell
npm.cmd run executar -- --spec "testes/transferencias/transferencias.cy.js"
```

**Esse comando opera o ambiente configurado:** pode enviar comandos ao MES, escrever a LSH e atualizar a LIR. Use-o somente com a bancada e a seleção conferidas. Não troque configurações, imports ou tarefas durante um lote ativo.

Para interromper, use Stop e confira os estados MES/S7 antes de uma nova execução. Fechar o Cypress não comprova a restauração de uma escrita enviada.

<a id="8-etapas-e-critérios-do-teste"></a>
## 8. Etapas e critérios do teste

| Etapa | Ação e condição de aprovação |
| --- | --- |
| Pré-validação | Conferir LIR, configuração, pendência, catálogo, LSH e consulta SQL inicial |
| Login | Autenticar no MES e preparar a sessão de navegação |
| Seleção | Confirmar local, transferência, origem, destino e rota exata |
| Preparação S7 | Consultar vínculos e selecionar os retornos do perfil |
| Partida | Acionar Iniciar e observar os equipamentos sem esperar primeiro a situação Iniciado |
| Confirmação | Validar os retornos S7 e a situação no MES; registrar evidências |
| Nível alto | Quando aplicável, persistir a intenção, escrever a LSH e confirmar entrada + Alm OU Aviso + MES |
| Restauração | Confirmar por releitura o retorno ao valor original antes de liberar a pendência |
| Encerramento | Finalizar ou limpar somente o cartão identificado e comprovar o local vazio |
| Persistência | Gravar eventos, evidência, histórico e resultado na LIR |

### Recusas, impedimentos e recuperação

A preparação do Transporte consulta o silo de origem. Estoque zero confirmado impede a partida e registra a origem e o motivo na LIR e no histórico. A consulta inconclusiva fica no diagnóstico e o fluxo de validação prossegue.

A recusa por nível alto deve corresponder ao destino da rota. Preserve a mensagem, a captura e o resultado. Quando as guardas do rearme PLCSIM permitem nova tentativa, ela é única. Uma segunda recusa com S7 normal pode adiar o mesmo destino naquele local até o próximo lote, conforme o fluxo implementado.

O reconhecimento do cartão depende do local e do nome esperado. Situação vazia, `+` e ícone `add` não constituem status real. Um cartão encerrado, identificado e sem Parar pode admitir Limpar, confirmação e verificação de local vazio. Cartões ativos, duplicados, de outro nome ou ambíguos não recebem limpeza indiscriminada.

Para cartão Interrompido ou Iniciar desabilitado, o diagnóstico registra condições visíveis e estados S7 confirmados. Informação indisponível permanece não verificada. A limpeza de cartão interrompido exige identidade e condições específicas, descritas no registro de estabilidade; o diagnóstico não transforma uma falha em aprovação.

O `afterEach` registra o resultado e pode executar a recuperação prevista, com guardas de identidade, execução e restauração. Para uma rota observada em Iniciado, a primeira parada de recuperação pode ser permitida. Isso não autoriza repetição indiscriminada de partida, parada, limpeza ou escrita com resposta incerta. Estado indefinido mantém o bloqueio.

<a id="9-resultados-evidências-e-planilha"></a>
## 9. Resultados e integridade da LIR

Cada lote possui sua própria pasta em `resultados/`. Histórico XLSX, capturas, evidência S7 e `eventos.jsonl` se complementam. O diário registra o recebimento do resultado e, em seguida, a confirmação de persistência. Uma falha de gravação não autoriza o próximo teste silenciosamente.

Na pasta `mes-s7-piloto`:

```powershell
npm.cmd run resumo -- Teste_rotas_Rev00_NOME_DA_EXECUCAO
```

O comando cria `resumo.json`, considera o último resultado por rota e aponta pendências. Ele não reaplica resultados automaticamente a outra LIR. Preserve a planilha e o JSONL para reconciliação.

### Gravação e backups

O gravador Node, introduzido no 11.4, valida ZIP/XML e trata o defeito conhecido de namespace antes da substituição. Preserva fórmulas, estilos e `calcChain`; solicita recálculo ao Excel. O gravador PowerShell antigo está desativado. O PowerShell da captura desktop tem outra finalidade.

Os backups ficam em `resultados/<execucao>/backups-lir`: `inicio` guarda a primeira versão do lote e `anterior` a versão imediatamente precedente. Não há uma cópia completa por rota. Hash, marcador Excel/LibreOffice e lock protegem a substituição. Não remova a trava de um gravador ativo.

### Planilha com aviso de reparo

1. Preserve o original antes de aceitar qualquer reparo do Excel.
2. Feche Excel e Cypress.
3. Execute `REPARAR_PLANILHA.cmd` ou arraste o XLSX sobre esse arquivo.
4. Abra a cópia gerada em `resultados/recuperacao` e confira todas as abas.
5. Troque a planilha ativa somente após conferir o conteúdo. Dados já removidos e salvos pelo Excel exigem original ou backup.

Alternativa, na pasta do piloto:

```powershell
npm.cmd run recuperar:planilha -- "C:\caminho\arquivo.xlsx"
```

O original não é sobrescrito. A contagem histórica de 340 fórmulas pertence à base antiga e não comprova a integridade de qualquer outra planilha.

<a id="10-recuperar-escrita-pendente"></a>
## 10. Recuperação de escrita pendente

O arquivo `resultados/controle/escrita-pendente.json` registra a intenção antes do comando. Sua remoção depende da normalização ou restauração confirmada, de acordo com o tipo de operação. Uma pendência bloqueia o próximo ensaio; reiniciar o Cypress não a resolve.

Se o Node permanecer ativo, a proteção de prazo tenta a restauração na sessão proprietária 15 segundos após o prazo de nível alto. O resultado é registrado no lote. Essa proteção não envia parada ao MES e não funciona após o término de todo o processo Node.

### Procedimento de conferência

1. Pare o lote e impeça novas execuções. Preserve o registro, os temporários e as evidências com seus horários.
2. Confira CPU, endereço, operação e valor esperado. Identifique a transferência exata no MES e coordene seu encerramento com o operador autorizado.
3. Confirme o sinal por leitura estável na CPU de simulação correta. Para ensaio de nível alto, confira `original`; para `rearme-plcsim`, confira `destino` e Alm/Aviso inativos.
4. Somente após a conferência, arquive o registro por renomeação, por exemplo `escrita-pendente-conferida-DATA.json`. Não o apague.
5. Recarregue o projeto. Se houver nova pendência, investigue o novo registro antes de continuar.

Uma falha de `rename` na fase confirmada pode ocorrer após a releitura da escrita pelo Monitor. Não presuma ausência de escrita a partir de uma falha de arquivo. A ocorrência antiga em `I128.4`, CPU `10.255.11.52`, original 1 é apenas um exemplo histórico; o registro da operação corrente é a referência.

<a id="11-diagnóstico-de-erros"></a>
## 11. Diagnóstico de erros

| Sintoma | Conferência e ação |
| --- | --- |
| `npm ci` falha na raiz | Execute nas subpastas `mes-s7-piloto` e `monitor-s7`; não há pacote npm na raiz |
| `ERR_MODULE_NOT_FOUND` para `@st-one-io/nodes7` | Instale as dependências em `monitor-s7` e inicie o serviço dessa versão |
| `s7.local.json` ausente | Confira a raiz do projeto Cypress e restaure a configuração validada |
| Senha MES ausente | Confira `credenciais.local.json`, chave `senhaMES`, extensão real e projeto aberto; recarregue a configuração |
| `fetch failed` em catálogo | Verifique serviço, URL, porta e diagnóstico com `--monitor` |
| API de diagnóstico retorna 404/405 | Encerre o Monitor antigo, inicie o da versão atual e repita o diagnóstico HTTP |
| Tarefa não registrada | Confira o projeto e mantenha a configuração integrada com os módulos correspondentes |
| Credencial SQL ausente | Confira o arquivo externo do usuário Windows que executa o Cypress |
| Certificado SQL recusado | Confira a CA e a política TLS da instalação |
| Nenhuma rota selecionada | Confira rota específica, modo de seleção, LIR e pendências reais |
| Cartão ausente ou ambíguo | Confira local e identidade; preserve evidências antes de intervir |
| Iniciar desabilitado | Preserve a captura e consulte o diagnóstico; resultado continua NOK |
| LSH já em nível alto | Confira polaridade, condição da bancada e guardas do rearme PLCSIM |
| Nível alto no CLP sem MES | Confira propagação DB11 e atualização MES, conforme o diagnóstico disponível |
| Restauração pendente / `EPERM` | Preserve registro e temporários; siga a seção 10 e confira bloqueios/permissões |
| Saída de gaveta pulsada | Confira perfil e retorno de posição, sem exigir saída mantida indevidamente |
| Falha ao gravar LIR | Feche Excel; confira lock, hash, permissões e diário antes de repetir |
| Planilha pede reparo | Gere uma cópia de recuperação; não sobrescreva o original com reparo destrutivo |
| Spec ou referência ausente | Confira `mes-s7-piloto`, `specPattern` e a integridade dos módulos |

Ao relatar um problema, informe rota, etapa, horário, versão, diretório real, erro completo e evidências relevantes. Oculte senhas e dados sensíveis.

<a id="12-git-e-controle-de-versão"></a>
## 12. Git e versionamento

`CONFIGURAR_GIT.cmd` configura a autoria dos commits no repositório indicado. Confira os valores definidos no utilitário antes de usá-lo com outra pessoa. Sem argumento, ele procura o repositório em `mes-s7-piloto` e depois na raiz. Não inicializa repositórios, cria commits ou envia arquivos. A autenticação GitHub é independente da autoria.

Antes de registrar alterações, confira:

```powershell
git status
git var GIT_AUTHOR_IDENT
```

Versione código, lockfiles, exemplos sem segredos e documentação. Revise o `.gitignore`: adicionar uma regra não remove arquivos já rastreados. Não publique credenciais, configurações locais, dependências ou capturas sem revisão.

Uma revisão documental não altera a versão funcional. O histórico desta revisão está no [changelog](CHANGELOG.md). Retornar o código no Git não restaura automaticamente entradas do CLP, banco, resultados ou configurações externas.

<a id="13-configurar-outro-projeto"></a>
## 13. Configuração de outro projeto

1. Crie uma instalação identificada, mantendo o histórico anterior.
2. Configure MES, credenciais e SQL da nova instalação.
3. Forneça a nova LIR e selecione seu caminho explicitamente.
4. Forneça o PEData correspondente e escolha o catálogo correto.
5. Confira CPU, perfis, IO/ID, polaridade e layout de DB. Os offsets de referência não são universais.
6. Resolva pendências do projeto original; não as transporte como configuração do novo projeto.
7. Faça diagnóstico e regressão. Depois, valide uma rota acompanhada antes do lote.

As fixtures CL373 validam o software em cenários conhecidos; não comprovam o cadastro nem o comportamento online de outro projeto. Novas telas ou tipos de equipamento podem exigir critérios e seletores específicos.

<a id="14-eficiência-manutenção-e-regressão"></a>
## 14. Desempenho e regressão

Melhorias de desempenho devem ser medidas sem reduzir os critérios de aprovação, os prazos funcionais ou as evidências obrigatórias. O [estudo do Piloto-12](mes-s7-piloto/docs/DESEMPENHO_PILOTO_12.md) apresenta amostras e candidatos à investigação; não demonstra ganho antes/depois.

- Mantenha o ciclo do Monitor e o intervalo de consulta coerentes com a bancada.
- Reutilize o catálogo correspondente à versão do projeto, sem reutilizar estado operacional antigo.
- Priorize seleções pendentes ou com falha quando esse for o objetivo do ensaio.
- Use busca rápida somente com estabilidade conferida; preserve a alternativa estável.
- Snapshots em memória e vídeo são diferentes das evidências persistidas em disco.
- `capturaDesktop: false` retira a visão desktop; não é uma otimização equivalente quando essa evidência é obrigatória.
- Arquive somente lotes encerrados e mantenha seus históricos, JSONL e referências. Não compacte ou apague o lote ativo nem `resultados/controle`.
- Gerencie cache Cypress, dependências, catálogos e resultados separadamente.

### Regressão isolada

Na raiz do repositório, com as dependências dos dois projetos instaladas:

```powershell
node verificar-tudo.cjs
```

Também é possível executar `VERIFICAR_REGRESSAO.cmd`. Para o piloto isoladamente, execute `npm.cmd test` em `mes-s7-piloto`; para conferir o catálogo offline, use `npm.cmd run verificar:catalogo` nessa mesma pasta, com a fonte configurada.

A regressão usa arquivos temporários e peers locais. Ela não substitui a validação do Windows/Excel nem do MES, SQL e CLP da bancada.

A regressão padrão cobre as suítes `.test.js` do Piloto, as do Monitor e a integração simulada. Para incluir o Recebimento, o cadastro de OR e a regra de estoque da origem, execute também a partir de `mes-s7-piloto`.

```powershell
$testes = Get-ChildItem -File -Path testes/recebimentos/*.test.cjs,testes/ordens-recebimento/*.test.cjs,testes/transferencias/estoque-origem.test.cjs | Select-Object -ExpandProperty FullName
node --test @testes
```

### Dependências

O `package.json` atual usa SheetJS `xlsx` **0.20.3**, por URL do fornecedor. A referência histórica a uma pendência em `xlsx` 0.18.5 pertence à versão anterior e não descreve a dependência declarada neste checkout. Esta revisão documental não executou uma nova auditoria nem declara ausência de vulnerabilidades. Preserve a origem de cada relatório e evite atualizações forçadas sem regressão da LIR.

### Revisão de versão com as Cypress AI Skills

Registre commit, versão do Node, resultado por grupo e limites da validação. As skills orientam o trabalho; os testes e evidências sustentam as conclusões.

| Skill | Aplicação | Evidência esperada |
| --- | --- | --- |
| `$cypress-explain` | Revisar a intenção, a sequência e as dependências do teste | Condição, tarefa, seletor e comportamento relacionado |
| `$cypress-docs` | Conferir APIs para a versão instalada | Versão instalada e fonte disponível no escopo autorizado |
| `$cypress-author` | Criar ou corrigir testes com os helpers existentes | Cenário, asserção e regressão |
| `$cypress-tap` | Inspecionar a sessão local correta e seu Command Log | PID/sessão, spec, novo início e resultado efetivamente executado |

Na máquina com o Cypress aberto, a partir de `mes-s7-piloto`:

```powershell
npx.cmd cypress tap sessions --json
npx.cmd cypress tap status --json
npx.cmd cypress tap reporter
```

Com várias sessões, selecione explicitamente a correta por `--session`, conforme a CLI instalada. Um resultado anterior não comprova uma reexecução. O spec depende do login e da navegação preparados; filtrar somente uma rota pode omitir essa preparação. Não execute novamente um lote ativo para apenas inspecioná-lo.

Referências: [Cypress AI Skills](https://docs.cypress.io/app/tooling/ai-skills), [Cypress Tap](https://docs.cypress.io/app/tooling/cypress-tap) e [registro de estabilidade](mes-s7-piloto/docs/PILOTO_11_ESTABILIDADE.md).

<a id="15-histórico-consolidado-e-limites"></a>
## 15. Histórico e limites da validação

| Marco | Evolução registrada |
| --- | --- |
| Monitor 0.11 | Pesquisa combinada, persistência de catálogos e identificação de I/O |
| Monitor 0.12 / 0.13 | Escrita pontual I/Q/M/DB com permissão e interface direta |
| Piloto 10.x | Ensaio de nível alto, polaridade e alternativas Alm/Aviso |
| Piloto 11 a 11.3 | Persistência, recuperação, identificação de cartões e confirmação do local vazio |
| Piloto 11.4 | Gravador Node, validação XML, backups e recuperação da LIR em cópia |
| Revisões documentais 01 e 02 | Consolidação do manual e inclusão da skill de evolução |
| Piloto-12 | Identificação funcional atual e coletor offline de tempos |
| Revisão documental 04 | Redação revisada, README de entrada e manual visual; sem mudança funcional |

### Evidências históricas

O registro do commit `b5f2168`, em 23/11/2026, informa **192 testes aprovados** no Windows com Node 24.22.1: 162 do Piloto, 25 do Monitor e 5 de integração simulada. A contagem 133 dos relatórios antigos pertence ao 11.4 e não deve ser apresentada como resultado da revisão atual.

O documento de estabilidade reúne ocorrências e verificações na VM, com seus limites e pendências. Os recortes de desempenho são parciais e têm seleções distintas; não constituem comparação controlada antes/depois. Esta revisão de apresentação não executou novo ensaio funcional nem confirmou um lote completo da bancada.

Os arquivos `VERSOES_INTEGRACAO.json`, relatórios e manifestos devem ser lidos com seu contexto de origem. A entrada histórica `auditoriaNpm` foi preservada como registro anterior; consulte a declaração atual de dependências e faça auditoria específica quando necessário.

<a id="16-evolução-dos-processos"></a>
## 16. Evolução dos processos

A [referência de Recebimento](.agents/skills/piloto-evolucao-processos/references/recebimento.md) registra modalidades, validações e decisões pendentes.

A matriz registra T01–T09 para Transporte e R01–R07 para Recebimento. Dosagem segue como esboço até a confirmação do ciclo, das tolerâncias e da modalidade do MICRO.

Use a [matriz de processos](.agents/skills/piloto-evolucao-processos/references/matriz-processos.md) para identificar regras e consumidores. Antes de alterar um módulo comum, confira os pontos de uso e as evidências exigidas. Registre ambiguidades sem inventar critérios.

A skill [piloto-evolucao-processos v0.4.0](.agents/skills/piloto-evolucao-processos/SKILL.md) orienta a revisão de regras e consumidores com um roteiro para as skills Cypress locais.

### Referências históricas da Rev04

- Branch: `piloto-11`.
- Commit de origem: `7e0f7a4cddb39f244c8be13389c7ec4c59bf0806`.
- Código funcional: `Piloto-12`.
- Monitor: `0.13.0`.
- Revisão documental: `04`.
- O [changelog](CHANGELOG.md) preserva o histórico das revisões documentais.
