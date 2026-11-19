# Manual de operação — MES + Monitor S7

**Revisão documental 01 · 19/11/2026 · Código recebido: Piloto 11.4 · Monitor: 0.13.0**

Este é o ponto único de consulta para operar o pacote enviado. A organização é documental: não altera regras do MES, SQL, S7, planilhas, resultados ou dependências. O nome externo Piloto_11 foi mantido porque é o diretório do projeto recebido; o log do código identifica 11.4. Não há nova versão funcional nem novo executável do Monitor nesta entrega. NUT/E3 permanece em espera.

As instruções atuais abaixo prevalecem sobre os documentos históricos. A documentação anterior foi arquivada integralmente em documentacao/DOCUMENTACAO_ANTERIOR_Rev01.zip. Só permanece um redirecionamento no caminho antigo citado pelo erro de restauração.

## Índice

1. [Estrutura e arquivos preservados](#1-estrutura-e-arquivos-preservados)
2. [Preparação e instalação](#2-preparação-e-instalação)
3. [Configuração MES e SQL](#3-configuração-mes-e-sql)
4. [Configuração S7 e critérios](#4-configuração-s7-e-critérios)
5. [Planilha e seleção de rotas](#5-planilha-e-seleção-de-rotas)
6. [Operar o Monitor](#6-operar-o-monitor)
7. [Executar o Cypress](#7-executar-o-cypress)
8. [Etapas e critérios do teste](#8-etapas-e-critérios-do-teste)
9. [Resultados, evidências e planilha](#9-resultados-evidências-e-planilha)
10. [Recuperar escrita pendente](#10-recuperar-escrita-pendente)
11. [Diagnóstico de erros](#11-diagnóstico-de-erros)
12. [Git e controle de versão](#12-git-e-controle-de-versão)
13. [Configurar outro projeto](#13-configurar-outro-projeto)
14. [Eficiência, manutenção e regressão](#14-eficiência-manutenção-e-regressão)
15. [Histórico consolidado e limites](#15-histórico-consolidado-e-limites)

## 1. Estrutura e arquivos preservados

| Caminho a partir da raiz do pacote | Função |
|---|---|
| MANUAL_OPERACAO.md | Manual atual |
| documentacao/ | Arquivo histórico dos Markdown originais, índice de origem e relatório da organização |
| CONFIGURAR_GIT.cmd | Configura autoria dos commits no repositório informado |
| mes-s7-piloto/ | Projeto a abrir no Cypress |
| mes-s7-piloto/cypress.config.js | Configuração integrada; preservar junto dos módulos comuns |
| mes-s7-piloto/testes/transferencias/ | Testes, seleção de rotas, leitura/gravação da LIR e tarefas |
| mes-s7-piloto/comum/s7/ | Consulta SQL, perfis, catálogo, leituras e ensaio LSH |
| mes-s7-piloto/scripts/ | Diagnóstico, resumo e recuperação da planilha |
| mes-s7-piloto/clp/System/PEData.plf | Fonte local do catálogo TIA |
| mes-s7-piloto/planilhas/ | LIR operacional; subpasta arquivo guarda versões alternativas |
| mes-s7-piloto/modelos/ | Modelos da planilha |
| mes-s7-piloto/resultados/ | Execuções, capturas, históricos e controle persistente |
| mes-s7-piloto/comum/fixtures/ | Dados de regressão; não substituir a LIR operacional por essas cópias |
| mes-s7-piloto/docs/validacao/ | Relatórios técnicos recebidos; podem refletir execuções históricas |
| mes-s7-piloto/.git/ | Histórico/configuração Git recebido, preservado sem reconfiguração |
| monitor-s7/ | Serviço e interface do Monitor, com dependências recebidas |
| verificar-tudo.cjs / VERIFICAR_REGRESSAO.cmd | Regressão local dos três grupos |

O pacote contém os dados enviados, inclusive resultados e configurações locais. Não sobrescreva uma instalação mais recente com esses dados. Ao aplicar somente esta organização à instalação ativa, copie o manual, a pasta documentacao, o utilitário Git e o redirecionamento documental; mantenha suas configurações, planilhas e resultados atuais. A extração mantém apenas um nível externo de Integracao_MES_S7_Piloto_11. Não crie outro diretório de mesmo nome dentro dele.

## 2. Preparação e instalação

Use Windows com Node.js 22 ou superior e acesso ao MES, SQL e CPU de simulação. O Monitor e Cypress devem apontar para a instância correta. Não execute duas cópias do piloto simultaneamente contra o mesmo MES/CLP.

1. Extraia o pacote em uma pasta identificável. Mantenha a versão anterior para retorno.
2. Preserve a LIR mais recente, resultados, credenciais locais e o estado de controle da instalação em andamento.
3. Confira node --version no terminal.
4. Se as dependências não estiverem instaladas, na pasta mes-s7-piloto execute npm.cmd ci. O lockfile é a referência. Isso pode exigir internet/cache do npm e do binário Cypress; não há instalador offline completo neste pacote.
5. Para o Monitor, use INICIAR_MONITOR.cmd ou o executável compatível 0.13 já disponível no computador. Nenhum novo .exe foi compilado aqui.
6. Confira as configurações antes de iniciar qualquer rota.

```powershell
# Execute na pasta mes-s7-piloto
node --version
npm.cmd run diagnostico
npm.cmd run diagnostico -- --monitor
```

O diagnóstico comum lê configurações, LIR e pendência em disco. Com --monitor, consulta metadados HTTP do catálogo; não escreve no CLP, não inicia transferência e não valida o SQL. A pré-validação do teste faz a consulta SQL de leitura.

## 3. Configuração MES e SQL

### MES

Edite mes-s7-piloto/execucao.local.json. Não copie comentários para dentro de JSON.

| Campo | Uso |
|---|---|
| planilha | Caminho relativo dentro de planilhas, por exemplo planilhas/CL373.00.LIR.04.xlsx |
| urlMes | URL da aplicação, nesta instalação http://localhost/nexxus-mes |
| usuarioMes | Usuário MES |
| selecaoRotas | pendentes, falhas, nao-testadas ou todas |
| modoBusca | estavel: reconsulta campo entre caracteres; rapida: digitação inteira em interface estável |
| capturaDesktop | true mantém captura desktop Windows; false usa somente captura pelo Cypress |
| numTestsKeptInMemory | Número de testes mantidos em memória no runner; exemplo 5 |
| esperaBuscaMs / esperaVisualS7Ms / esperaMesSemS7Ms | Esperas adicionais de 0 a 10000 ms; manter 0 quando a sincronização por condição funcionar |

A senha MES pode ser lida de credenciais.local.json, chave senhaMES, conforme o fluxo instalado. O arquivo de exemplo é apenas referência; não coloque senhas no manual ou em commits. Preserve os mecanismos de credencial existentes. Campos desconhecidos em execucao.local.json são recusados.

### SQL Server

O módulo lê a configuração externa em %LOCALAPPDATA%/Nexxus/cypress-clp/sql.local.json. Se essa não existir e a pasta antiga CypressCLP tiver o arquivo, utiliza a antiga. Esse caminho é por usuário do Windows e fica fora do projeto intencionalmente.

Campos: server, instance, database, user, password, port opcional, trustServerCertificate e caFile opcional. Com port explícita, a instância nomeada não é aplicada pelo módulo. Sem porta, instance configura a instância SQLEXPRESS desta instalação. Variáveis FMS_SQL_* existentes no processo podem prevalecer sobre os dados do arquivo.

Para certificado confiável, use a CA em caFile (caminho relativo à pasta SQL local). Para a bancada que usa certificado autoassinado e aceita esse modo, trustServerCertificate: true dispensa caFile e aceita o certificado do servidor; a conexão continua encrypt: true. Use booleanos sem aspas. Essa escolha deve corresponder à configuração de conexão da instalação.

A consulta é parametrizada pelo código da rota e cruza dbo.[Rota.Segmento.Equipamento] com dbo.[Equipamento]. O nome textual da rota não define sozinho todos os equipamentos. Não substitua o cypress.config.js integrado por um config de exemplo: isso perde os registros de tarefas existentes.

## 4. Configuração S7 e critérios

Edite mes-s7-piloto/s7.local.json. Configuração recebida: host 10.255.11.52, rack 0, slot 1, pollMs 200, intervaloConsultaMs 1000, prazoS7Ms 45000, modoValidacao entradas e tipoContatoLSH 1. Esses são valores da bancada, não padrões universais.

| Campo | Função |
|---|---|
| habilitado | true = MES + S7; false = fluxo MES |
| codigoRota | null para lote; número inteiro para rota específica |
| monitor | URL do serviço HTTP, normalmente http://127.0.0.1:3000 |
| host / rack / slot | CPU de destino e parâmetros da conexão S7 |
| peData | clp/System/PEData.plf |
| fonteCatalogo | automatico, monitor ou arquivo, conforme suporte do código |
| catalogoId | Identificador de catálogo para seleção explícita, ou null |
| modoValidacao | sql para perfil por equipamento/tipo; entradas para sempre usar retornos de entrada |
| incluirLSHNoMonitor | Inclui LSH no monitoramento |
| escritaManualLSH | Permissão usada no mapeamento da LSH para escrita; não substitui a fase automática |
| nivelAlto.habilitado | Habilita ensaio LSH nas rotas aplicáveis |
| nivelAlto.prazoMs | Prazo para reação de nível alto; recebido 60000 ms |

Mesmo em modo entradas, o SQL continua necessário para descobrir os vínculos da rota e o comando de cada equipamento. Em modo sql, perfis-s7.json escolhe por cod_equipamento antes de tip_equipamento; a regra determina EspelhoEntrada1/2 ou EspelhoSaida1/2 e a necessidade de desligado inicial. Tipo sem regra válida falha explicitamente. Comando 0 é ignorado nos retornos de acionamento; comando 1 ou 2 escolhe o espelho correspondente.

Gavetas de duplo solenoide podem emitir apenas pulso na saída. Para confirmar posição estável, utilizar retorno de entrada conforme perfil ou modo entradas, sem exigir saída permanentemente ligada.

### Polaridade e alarme LSH

| tipoContatoLSH | Contato | Nível alto na entrada | Sem nível alto |
|---|---|---|---|
| 0 | NA | 1 / true | 0 / false |
| 1 | NF | 0 / false | 1 / true |

O botão Aciona do Monitor escreve 1; Desaciona escreve 0. Isso não significa automaticamente ativar/desativar alarme: para NF, o nível alto é 0.

Nesta bancada, nivelAlto.offsetsConfirmacao contém 1.0 e 1.1: Alm OU Aviso pode confirmar o sensor, junto da entrada e do status MES. Não são dois alarmes obrigatórios simultâneos. O endereço explícito conhecido de LSH_MG14 consta em alarmesConfirmados. Não derive DB/offset de um ID sem confirmação no catálogo. O layout deve ser revisto ao mudar de projeto.

## 5. Planilha e seleção de rotas

Mantenha a LIR mais recente na pasta planilhas e defina seu caminho em execucao.local.json. Sem caminho explícito, a descoberta deve encontrar uma única planilha real além do modelo; múltiplos candidatos exigem seleção explícita. Não use arquivos temporários do Excel como planilha operacional. Nomes arbitrários são possíveis se o conteúdo e os cabeçalhos forem compatíveis.

A aba de rotas usada pelo gravador é Lista de Rotas - Transferências. Não renomeie abas/cabeçalhos operacionais sem adequação controlada do leitor. O piloto confere identidade da linha e status antes de atualizar. IO/ID e campos de nível alto devem estar preenchidos de acordo com a LIR do projeto; ausência não deve virar endereço presumido.

| selecaoRotas com codigoRota null | Seleção |
|---|---|
| pendentes | Teste NT/NOK; com nível habilitado, também pendências de nível aplicáveis |
| falhas | Teste NOK ou nível alto NOK aplicável |
| nao-testadas | Apenas Teste NT |
| todas | Todas as rotas aplicáveis, incluindo OK |

Para retestar a rota 91, configure codigoRota: 91; para voltar ao lote, codigoRota: null. Não use string vazia nem 0 como lote. Com todas as rotas da seleção concluídas, o piloto informa a ausência de pendências; os totais dependem da LIR atual, não dos números históricos das versões.

Alterações em configurações, planilha ou seleção exigem recarregar a configuração do projeto no Cypress para reconstruir o lote. Reexecutar somente uma spec pode reutilizar a configuração anterior. O watcher foi desativado para impedir reinício involuntário durante uma operação.

## 6. Operar o Monitor

1. Inicie monitor-s7/INICIAR_MONITOR.cmd (Node) ou o executável compatível já instalado. Mantenha o serviço aberto durante o lote.
2. Abra a URL exibida no terminal, normalmente http://127.0.0.1:3000. Loopback é a máquina do processo/navegador; não é automaticamente o servidor MES.
3. Configure a CPU e confira o estado da conexão. Conectado sem tags significa negociação concluída, sem leituras mapeadas.
4. Abra um catálogo salvo correspondente à CPU ou importe a pasta principal TIA com o PEData. O catálogo persistente evita varredura repetida; abrir o cache não comprova a versão efetiva carregada na CPU.
5. Pesquise nome, palavras, DB ou endereço; combine área, grupo e tipo. Use limpar filtros para reiniciar a pesquisa. A lista pagina resultados para não renderizar tudo de uma vez.
6. Adicione os pontos necessários e aplique tags. Monitorar e Permitir escrita são escolhas por ponto. O checkbox antigo de conferência do nome não é mais obrigatório.
7. Use Cartões/Tabela e ajuste a apresentação disponível. A visualização do piloto também mostra tabela de acompanhamento no runner; ela acompanha as tarefas e não depende de iframe da página completa do Monitor.

Catálogos ficam por padrão em %LOCALAPPDATA%/Nexxus/MonitorS7/catalogos, fora da instalação. São mantidos até remoção explícita. O PEData e JSON extraído ocupam espaço por versão; não há cópia por consulta. MONITOR_S7_DATA_DIR pode alterar o diretório do serviço. Conexão/mapeamento da sessão e catálogo persistente são estados diferentes; abrir um catálogo não reconecta automaticamente a CPU.

A escrita é pontual, com confirmação e releitura; não é força cíclica. A CPU/simulação pode sobrescrever o valor. BOOL usa Aciona/Desaciona sem modal; números usam editor inline. Endereço, sessão, qualidade, faixa e permissão continuam validados. Não interpretar acknowledged isolado como sensor estabilizado: conferir verified/observed e a reação do programa.

### Endereçamento

| TIA | Monitor | Interpretação |
|---|---|---|
| %I34.6 | I34.6 | Entrada BOOL |
| DB1149.DBX1.5 | DB1149,X1.5 | Bit de DB, byte 1 bit 5 |
| DB5.DBW2 com INT | DB5,INT2 | Inteiro no byte 2 |
| DB5.DBD4 com REAL | DB5,REAL4 | Real no byte 4 |

O texto do endereço usa a sintaxe do driver S7, preservando área/byte/bit/tipo. Não é uma conversão por nome Siemens. Confirmar offsets do catálogo com o projeto; o extrator PEData reconhece estruturas específicas e pode ter catálogo parcial. Para DB absoluto clássico, verificar acesso padrão e configuração de comunicação da CPU da bancada.

## 7. Executar o Cypress

Na pasta mes-s7-piloto, execute ABRIR_CYPRESS.cmd ou:

```powershell
npm.cmd run abrir
```

Escolha E2E e o navegador. Abra testes/transferencias/transferencias.cy.js. Não abra outro projeto aninhado por engano. Confirme no log a versão, seleção e host antes do lote.

Para execução pelo terminal com navegador visível, npm.cmd run executar. Use esse modo somente depois de validar a configuração no runner. Não troque config, tarefas ou imports durante um teste ativo.

Para interromper, use Stop e confira o estado MES/S7 antes de nova execução. Fechar o Cypress não garante restauração de uma escrita já enviada. O arquivo de pendência deve ser respeitado.

## 8. Etapas e critérios do teste

| Etapa | Ação e aprovação |
|---|---|
| Pré-validação | Conferir LIR, configuração, registro pendente, catálogo/LSH e SQL inicial |
| Login | Acessar MES, autenticar e abrir transferência |
| Seleção | Local, transferência, origem, destino e rota; conferir seleção exata |
| Preparar S7 | Consultar todos os vínculos SQL e escolher os retornos; preparar leitura |
| Partida | Clicar Iniciar e acompanhar S7 imediatamente; não aguardar Iniciado para começar a ler equipamentos |
| Confirmar | Retornos esperados e situação MES; registrar evidências |
| Nível alto | Se aplicável: registrar intenção, escrever LSH conforme NA/NF, confirmar entrada + Alm OU Aviso + MES Nível Alto |
| Restaurar | Retornar ao valor original e confirmar por releitura; só então remover registro da escrita |
| Encerrar | Finalizar/limpar transferência e comprovar local vazio antes de liberar outra rota |
| Persistir | Eventos, evidência, histórico e atualização LIR com resultado |

Se o MES recusar partida por destino já em nível alto, registrar NOK, evidência e fechar a mensagem. A próxima rota só é liberada após confirmar ausência de transferência/diálogo e restauração quando houver escrita do piloto.

Cartões são procurados no local certo pelo nome esperado, sem usar o botão Limpar do formulário como sinal de transferência ativa. Contêiner Situação vazio, + ou ícone add não é status real. Um cartão do nome esperado, sem Parar, com um único Limpar e sem status real pode ser encerrado por Limpar → confirmação → Sim → confirmação de local vazio. Cartão ativo, de outro nome, duplicado ou estado ambíguo não recebe limpeza indiscriminada.

O afterEach confere o estado e registra resultados; não repete automaticamente comandos de partida, parada, limpeza ou escrita cuja resposta ficou incerta. A restauração normal da LSH pertence ao fluxo de controle previsto. Lote bloqueado por estado indefinido deve ser investigado, não contornado removendo validações.

## 9. Resultados, evidências e planilha

Cada execução tem pasta própria em resultados. Histórico XLSX, capturas, evidências S7 e eventos.jsonl são complementares. O diário registra resultado recebido antes da persistência da planilha e depois a confirmação de persistência. Uma falha de gravação não deve apagar o resultado original nem autorizar o próximo teste silenciosamente.

```powershell
# Dentro de mes-s7-piloto; substitua pelo nome real da pasta
npm.cmd run resumo -- Teste_rotas_Rev00_NOME_DA_EXECUCAO
```

O comando cria resumo.json, considera o último resultado por rota e sinaliza pendências de persistência. Não reaplica automaticamente resultados a outra LIR. Preserve o JSONL e a planilha em uso para reconciliação.

### Integridade e recuperação da LIR

A rotina 11.4 grava por Node, normaliza o defeito conhecido de namespace XML e valida todo XML e ZIP antes de substituir a LIR. O PowerShell antigo de gravação foi desativado; PowerShell de captura desktop é outro recurso. Fórmulas, estilos e calcChain são preservados; células de fórmula não são sobrescritas. Solicita recálculo ao Excel.

Backups ficam em resultados/<execucao>/backups-lir: inicio (primeira versão daquela execução) e anterior (versão imediatamente anterior). Não é um backup por rota. O gravador confere hash, marcador Excel/LibreOffice e lock antes da substituição. Se existir trava de outro gravador, não apague enquanto ele estiver ativo.

Para o aviso Excel de namespace d6p1/xml ou conteúdo ilegível:

1. Preserve o original sem aceitar/salvar reparos destrutivos do Excel.
2. Feche Excel e Cypress.
3. Execute REPARAR_PLANILHA.cmd em mes-s7-piloto; ou arraste o XLSX problemático sobre ele, inclusive fora da pasta original.
4. Abra a nova cópia em resultados/recuperacao e confira todas as abas/resultados antes de trocar a ativa.
5. Se o Excel já removeu dados e você salvou por cima, use original/backup; a ferramenta não inventa conteúdo apagado.

Alternativa: npm.cmd run recuperar:planilha -- "C:\caminho\arquivo.xlsx". O original não é sobrescrito. A verificação da base antiga preservou 340 fórmulas; esse número não é garantia de conteúdo para qualquer planilha. O estado atual da LIR enviada não deve ser substituído por fixtures ou bases históricas.

## 10. Recuperar escrita pendente

Uma escrita LSH cria resultados/controle/escrita-pendente.json antes do comando e só o remove após restauração confirmada. Em interrupção ou resposta perdida, a próxima execução bloqueia. Fechar/reabrir o Cypress não apaga a pendência. Não é necessariamente uma falha de conexão.

1. Pare o lote. Abra o JSON no projeto indicado pelo erro atual.
2. Confira host, endereço e original, além do estado das transferências.
3. Na mesma CPU de simulação, restaure o valor original se necessário e confirme leitura válida/estável. Não use sempre 0: NF pode exigir 1.
4. Só após conferência, renomeie o arquivo para escrita-pendente-conferida-DATA.json. Preserve o registro.
5. Recarregue o projeto/execute novamente. Se reaparecer, investigar a nova pendência.

Exemplo da ocorrência relatada: I128.4, CPU 10.255.11.52, original 1. Esses valores são daquele registro, não substituem a leitura do JSON da próxima ocorrência. O piloto não força ciclicamente a entrada nem reconstrói uma sessão de escrita antiga ao reiniciar.

## 11. Diagnóstico de erros

| Mensagem/sintoma | Verificação e ação |
|---|---|
| fetch failed em validarCatalogoS7 | Serviço do Monitor, URL/porta, processo e acesso HTTP; consulte diagnóstico com --monitor antes de iniciar |
| consultarRota não registrada | Projeto/config errado ou módulos incompletos; manter o config integrado e o pacote conjunto |
| user/password SQL ausentes | Conferir o sql.local.json do usuário Windows que executa Cypress |
| self-signed certificate / caFile | Conferir política TLS configurada e caminho PEM externo, ou trustServerCertificate da bancada |
| Nenhuma rota selecionada | codigoRota, selecaoRotas, LIR e status atuais; todas OK pode significar ausência legítima de pendências |
| Cartão ausente/ambíguo | Aba/local correto e renderização; preserve evidência antes de intervir; não selecionar o primeiro cartão arbitrariamente |
| Cartão só com Limpar | Aplicar regra de encerramento identificado; ausência de Parar não implica sempre erro |
| LSH já em nível alto | Conferir condição de processo/polaridade; recusa de partida deve virar NOK com recuperação de estado conhecido |
| Restauração pendente em disco | Seguir seção 10; reiniciar serviço não resolve o registro |
| Saída de gaveta não permanece | Verificar tipo/perfil e retorno de entrada; pulso não é confirmação permanente de posição |
| Alarme não confirma | Conferir permanência da entrada, catálogo/layout, Alm/Aviso e reação do MES |
| Erro ao salvar LIR | Fechar Excel; verificar lock, hash, permissões e JSONL; preservar dados antes de nova execução |
| Planilha pede reparo | Recuperação por cópia da seção 9; não sobrescrever o original com remoção automática do Excel |
| Pastas/referências sumiram no Cypress | Abrir mes-s7-piloto correto; conferir specPattern e módulos, sem substituir config por exemplo |

Para investigar, registrar código da rota, etapa, horário, versão, erro completo, evidência e diretório real do projeto. Não compartilhar senhas em prints ou relatórios.

## 12. Git e controle de versão

CONFIGURAR_GIT.cmd, na raiz do pacote, configura user.name Lucas Colombo e user.email sr.colomboo@gmail.com no repositório indicado. Sem argumento procura o repositório em mes-s7-piloto (onde está o .git recebido) e depois na própria raiz. Um caminho pode ser passado como argumento. Não inicializa nem substitui repositórios, não cria commit e não envia arquivos. A autenticação GitHub é separada e depende das credenciais do Git instaladas no computador.

Execute antes dos commits e confira git status. Versione código, lockfile, configurações de exemplo e documentação. Não envie senhas, configuração local, projetos CLP grandes, dependências e capturas sem revisar o .gitignore. Um arquivo já rastreado não deixa de ser rastreado só por entrar no .gitignore. As regras recebidas foram preservadas nesta organização; não houve remoção do índice Git.

Use commits com objetivo e versão, por exemplo: "docs: consolidar manual de operação Rev01". Para retornar uma versão funcional, preservar também os dados/configurações compatíveis; git checkout sozinho não restaura entradas do CLP, banco ou resultados externos.

## 13. Configurar outro projeto

1. Criar instalação identificada para o projeto novo e manter o histórico do anterior. Não executar instâncias concorrentes sobre a mesma bancada.
2. Ajustar URL/credenciais MES e SQL externo. Não herdar credenciais como se fossem padrão.
3. Colocar a LIR nova dentro de planilhas e selecionar explicitamente em execucao.local.json.
4. Colocar PEData correspondente em clp/System e selecionar/importar o catálogo certo no Monitor.
5. Ajustar CPU, modo de validação, perfis, IO/ID e polaridade LSH. Rever layout de DB e offsets; 1.0/1.1 não é universal.
6. Não transportar pendência de uma operação ativa como se fosse dado de configuração. Resolver a operação original; iniciar o projeto novo com estado conhecido.
7. Executar diagnóstico e regressão; depois ensaiar uma rota com acompanhamento antes do lote.

A base automatizada de fixtures CL373 testa regressão do software; não comprova o cadastro ou comportamento online de outro projeto. Projeto com tipos de equipamentos ou telas diferentes pode exigir ajuste de perfil/seletor e ensaio específico.

## 14. Eficiência, manutenção e regressão

- Manter ciclo do Monitor e intervalo de consulta coerentes (bancada: 200 ms e 1000 ms), sem reduzir prazo de reação para acelerar artificialmente.
- Reutilizar catálogo persistente e índice do lote. Nova versão de projeto exige seleção/importação correspondente e nova execução.
- Priorizar lote pendentes/falhas. Modo de busca rapida só após ensaio da estabilidade de renderização.
- Manter poucos snapshots no runner (recebido 5), vídeo desativado e sem repetição automática de comandos. Reduzir snapshots não elimina evidências salvas em disco.
- capturaDesktop false reduz processo PowerShell de captura, com perda da visão desktop; é alternativa de configuração, não mudança aplicada nesta organização.
- Ao arquivar execuções concluídas, guardar histórico/JSONL/capturas necessários e conferir referências da LIR. Não apagar nem compactar a execução ativa ou resultados/controle durante os testes.
- Acompanhar espaço do cache Cypress, node_modules, catálogos e resultados separadamente. Não limpar automaticamente os catálogos escolhidos pelo operador.

Regressão local, na raiz do pacote:

```powershell
node verificar-tudo.cjs
```

Ou VERIFICAR_REGRESSAO.cmd. Requer dependências de teste nos dois projetos; quando necessário, npm.cmd ci em mes-s7-piloto e monitor-s7. Para somente piloto, npm.cmd test. Para catálogo offline, npm.cmd run verificar:catalogo na pasta mes-s7-piloto. Os testes usam arquivos temporários e peers locais; não são operação da bancada MES/SQL/CLP real.

A auditoria recebida registra pendência alta em xlsx. O patch XML não a resolve. Não executar npm audit fix --force como troca cega de dependência; planejar substituição/atualização com regressão da LIR. Esta organização não atualiza bibliotecas nem declara a vulnerabilidade resolvida.

## 15. Histórico consolidado e limites

| Marco | Comportamento incorporado |
|---|---|
| Monitor 0.11 | Pesquisa combinada, catálogos persistentes, identificação de I/O |
| Monitor 0.12/0.13 | Escrita pontual I/Q/M/DB com permissão; BOOL direto, sem modal ou checkbox antigo |
| Piloto 10.x | Nível alto, polaridade 0/1, alternativas Alm/Aviso, recusa de partida por nível |
| Piloto 11 | Eventos e persistência, recuperação controlada, eficiência de busca e catálogo |
| Piloto 11.1/11.2 | Recuperação somente com estado conhecido e identificação correta de vazio/cartão |
| Piloto 11.3 | Limpar cartão encerrado identificado, confirmar diálogo e local vazio |
| Piloto 11.4 | Gravador Node, XML estrito, backup e recuperação de LIR em cópia |
| Organização Rev01 | Manual consolidado, documentação anterior arquivada, utilitário de identidade Git incluído |

Os Markdown históricos permanecem integralmente no ZIP documental, com nomes/caminhos e hashes em documentacao/INDICE_DOCUMENTOS.json. Eles contêm decisões, exemplos e relatórios de épocas diferentes; não aplicar instruções antigas de modal, checkbox obrigatório ou gravador PowerShell como operação atual. Relatórios JSON/TXT de validação e SQL auxiliares permanecem em seus caminhos.

Os 133 testes aprovados documentados no 11.4 são resultados locais históricos. Nesta organização, a regressão foi novamente executada sobre o pacote recebido: 105 testes do piloto, 25 do Monitor e 3 de integração simulada, totalizando 133 aprovados, zero falhas e zero ignorados. Foi necessário disponibilizar jsdom como dependência de teste do Monitor no ambiente local; essa ligação temporária não integra o ZIP. O relatório está em documentacao/REGRESSAO_ORGANIZACAO_Rev01.txt. Nenhum ensaio aqui substitui validação no Windows/Excel, MES, SQL e PLC da bancada. Não houve recompilação de .exe, implantação remota nem alteração de entradas reais nesta organização.

Os manifestos e relatórios da raiz recebidos são registros de origem/versões anteriores e foram preservados. Para os hashes desta organização use documentacao/MANIFESTO_ORGANIZACAO_Rev01.json e para a comparação com o arquivo enviado use documentacao/RELATORIO_ORGANIZACAO_Rev01.json.
