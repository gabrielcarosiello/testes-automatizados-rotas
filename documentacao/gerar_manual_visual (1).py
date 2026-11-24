<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Piloto MES e S7 · Manual visual Rev04</title>
<style>
:root{--nav:#142837;--nav-soft:#203b4c;--ink:#233849;--muted:#576d7a;--paper:#fff;--bg:#f3f6f8;--line:#dce5ea;--teal:#147d87;--violet:#6b5297;--amber:#936111;--radius:12px;--sidebar:278px}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:28px}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}a{color:#136d80;text-decoration:none}a:hover{text-decoration:underline}button,input{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #55bfc9;outline-offset:3px}
.sidebar{position:fixed;inset:0 auto 0 0;width:var(--sidebar);background:var(--nav);color:#d3e2e9;display:flex;flex-direction:column;padding:28px 18px 20px;z-index:20}.brand{padding:0 13px 22px;border-bottom:1px solid #345061}.eyebrow{font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase}.brand strong{display:block;font-size:25px;line-height:1.4;color:white;letter-spacing:-.6px}.brand small{font-size:12px;color:#a7c0cc}.sidebar label{display:block;font-size:11px;color:#b8cdd7;margin:18px 9px 6px}.search-box{position:relative}.search-box input{background:#203b4c;color:white;width:100%;border:1px solid #406071;border-radius:8px;padding:10px 34px 10px 12px;font-size:13px}.search-box input::placeholder{color:#a8c0cc}.search-box button{position:absolute;right:7px;top:8px;border:0;background:transparent;color:#c6dce5;font-size:20px;line-height:1.2}.nav{overflow-y:auto;margin:15px -4px 0;padding:0 4px 14px;scrollbar-width:thin;scrollbar-color:#486170 transparent}.nav a{display:flex;gap:10px;padding:9px 10px;margin:2px 0;border-radius:7px;color:#cbdce4;font-size:12px;line-height:1.45;align-items:baseline;border-left:3px solid transparent}.nav a span{color:#7fa1b3;min-width:18px;font-size:10px;font-weight:700}.nav a:hover{background:#203b4c;text-decoration:none}.nav a.active{background:#234958;color:white;border-left-color:#56c8c7}.nav a.active span{color:#7edbd8}.sidebar-footer{margin-top:auto;border-top:1px solid #345061;padding:14px 10px 0;font-size:11px;color:#9eb8c7}.sidebar-footer b{color:#d9e8ec}
.page{margin-left:var(--sidebar);padding:34px 48px 70px;max-width:1560px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:22px;color:var(--muted);font-size:12px}.toolbar .buttons{display:flex;gap:8px}.btn{border:1px solid #c8d6df;border-radius:7px;padding:8px 13px;background:white;color:var(--ink);font-weight:600;font-size:12px}.btn:hover{background:#eaf1f5;text-decoration:none}.menu{display:none}.hero{background:var(--paper);border:1px solid var(--line);border-top:5px solid var(--teal);border-radius:var(--radius);padding:36px 40px 30px}.hero .eyebrow{color:var(--teal)}h1{font-size:43px;line-height:1.12;letter-spacing:-1.3px;font-weight:700;margin:12px 0 17px;max-width:760px}.hero .lead{font-size:17px;line-height:1.65;max-width:790px;color:var(--muted);margin:0}.tags{display:flex;gap:8px;flex-wrap:wrap;margin:23px 0 25px}.tag{display:inline-block;border-radius:5px;padding:5px 10px;font-size:11px;font-weight:700;background:#e4f2f1;color:#146c72}.tag.violet{background:#eee9f5;color:#634889}.tag.gray{background:#edf1f5;color:#455d70}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding-top:22px;border-top:1px solid var(--line)}.facts small{display:block;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)}.facts b{font-size:18px;display:block;margin-top:2px}.hero-foot{margin:18px 0 0;font-size:12px;color:var(--muted)}.jump-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.jump{display:block;background:white;border:1px solid var(--line);border-radius:9px;padding:17px 16px}.jump b{display:block;font-size:14px}.jump small{display:block;color:var(--muted);font-size:11px;line-height:1.5;margin-top:5px}.jump:hover{text-decoration:none;border-color:#7eb5be;background:#faffff}.notice{margin:20px 0 26px;background:#fff8e9;border:1px solid #ecdfc0;border-left:4px solid #b27c20;border-radius:7px;padding:16px 20px;font-size:13px;color:#6d521d}.notice b{display:block;margin-bottom:4px}.search-status{font-size:13px;color:var(--muted);margin:20px 0}.doc-section{margin:24px 0;background:white;border:1px solid var(--line);border-radius:var(--radius);padding:30px 34px 34px;overflow-wrap:anywhere;--section:var(--teal)}.doc-section.recuperar{--section:var(--amber)}.doc-section.evoluir{--section:var(--violet)}.section-label{color:var(--section);font-size:10px;font-weight:750;letter-spacing:1.7px;text-transform:uppercase;margin:0 0 9px}.doc-section h2{font-size:28px;line-height:1.25;margin:0 0 20px;letter-spacing:-.5px;color:#192f40}.doc-section h3{font-size:19px;line-height:1.4;margin:32px 0 12px;color:var(--section)}.doc-section p{margin:12px 0}.doc-section li{margin:6px 0}.doc-section ol,.doc-section ul{padding-left:24px}.doc-section code{font:12.5px/1.55 Consolas,"Liberation Mono",monospace;padding:2px 5px;border-radius:4px;background:#edf2f6;color:#244c66}.code-wrap{position:relative;margin:20px 0}.code-wrap pre{margin:0;background:#172c3d;border:1px solid #253f51;border-radius:8px;padding:40px 20px 18px;overflow-x:auto;color:#e0eef4;line-height:1.65}.code-wrap pre code{color:inherit;background:none;padding:0;font-size:12px;white-space:pre}.copy{position:absolute;right:10px;top:8px;border:1px solid #4c6372;background:#253f51;color:#e0eef4;border-radius:5px;padding:3px 9px;font-size:10px}.code-lang{position:absolute;left:19px;top:10px;color:#93b6c8;text-transform:uppercase;font-size:9px;letter-spacing:1px}.table-wrap{overflow:auto;margin:19px 0;border:1px solid #d8e3e9;border-radius:8px}table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.6}th{background:#e7eff4;color:#253f52;font-size:11px;text-align:left;padding:12px 14px;border-bottom:1px solid #c9d9e2;white-space:normal}td{padding:12px 14px;vertical-align:top;border-bottom:1px solid #e3ebef;border-right:1px solid #e9eef2;min-width:100px}tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#f7fafb}td:first-child{font-weight:550}td code,th code{font-size:11px;white-space:normal;word-break:break-word}.source-note{font-size:12px;color:var(--muted);background:#f3f0f8;padding:10px 13px;border-radius:6px}.footer{margin-top:36px;color:var(--muted);font-size:11px;border-top:1px solid var(--line);padding-top:18px}.footer strong{color:var(--ink)}[hidden]{display:none!important}.to-top{position:fixed;bottom:22px;right:24px;background:#147d87;color:white;border:0;border-radius:7px;padding:10px 15px;font-size:12px;box-shadow:0 4px 18px #14283720}.no-results{padding:28px;background:white;border:1px solid var(--line);border-radius:8px}
@media(min-width:1600px){.page{padding-left:65px;padding-right:65px}}
@media(max-width:1100px){:root{--sidebar:240px}.page{padding:25px}.hero{padding:28px}h1{font-size:36px}.doc-section{padding:26px}.jump-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.sidebar{transform:translateX(-100%);width:278px;transition:transform .2s}.sidebar.open{transform:translateX(0);box-shadow:10px 0 80px #14283780}.page{margin-left:0;padding:18px 14px 55px}.menu{display:inline-block}.toolbar{font-size:10px}.toolbar .buttons{gap:5px}.btn{padding:7px 9px;font-size:10px}.hero{padding:25px 21px}h1{font-size:32px}.hero .lead{font-size:15px}.facts{gap:12px}.facts b{font-size:15px}.facts small{font-size:8px}.doc-section{padding:24px 18px}.doc-section h2{font-size:24px}.jump{padding:13px}.notice{padding:13px 16px}.to-top{bottom:14px;right:14px}.table-wrap{border-radius:5px}table{font-size:11px}th,td{padding:10px;min-width:120px}}
@media print{html{scroll-behavior:auto}body{background:white;font-size:10pt;line-height:1.45;color:black}.sidebar,.toolbar,.jump-grid,.to-top,.copy,.search-status,.no-results{display:none!important}.page{margin:0;padding:0;max-width:none}.hero{border:0;border-bottom:2px solid #147d87;border-radius:0;padding:0 0 20px}.hero h1{font-size:30pt}.hero .lead{font-size:12pt}.hero .tags{margin:15px 0}.doc-section{border:0;border-radius:0;margin:20px 0;padding:0;overflow:visible}.doc-section h2{font-size:19pt;margin:8px 0 12px}.doc-section h3{font-size:13pt;margin:20px 0 8px}.table-wrap{overflow:visible;border-radius:0}table{font-size:8pt}th,td{padding:7px;min-width:0}th{background:#e7eff4!important}thead{display:table-header-group}tr,pre,.notice,.facts{break-inside:avoid}h2,h3,.section-label{break-after:avoid}pre{white-space:pre-wrap!important;overflow-wrap:anywhere;background:#f0f3f5!important;color:#172c3d!important;padding:15px!important}.code-lang{display:none}.table-wrap,.code-wrap{margin:12px 0}.notice{font-size:10pt;margin:18px 0}.source-note{background:none;padding:0}.footer{font-size:8pt}a{color:#18576b;text-decoration:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:18mm 15mm}}
</style></head><body>
<aside class="sidebar" id="sidebar" aria-label="Navegação do manual"><div class="brand"><div class="eyebrow">Documentação técnica</div><strong>Piloto MES + S7</strong><small>Nexxus · Automação e testes</small></div>
<label for="search">BUSCAR NO MANUAL</label><div class="search-box"><input id="search" type="search" placeholder="LSH, instalação, regras…" autocomplete="off"><button id="clear" aria-label="Limpar pesquisa">×</button></div><nav class="nav"><a href="#1-estrutura-e-arquivos-preservados"><span>01</span>Estrutura e documentos</a><a href="#2-preparação-e-instalação"><span>02</span>Preparação e instalação</a><a href="#3-configuração-mes-e-sql"><span>03</span>Configuração MES e SQL</a><a href="#4-configuração-s7-e-critérios"><span>04</span>Configuração S7 e critérios</a><a href="#5-planilha-e-seleção-de-rotas"><span>05</span>Planilha e seleção de rotas</a><a href="#6-operar-o-monitor"><span>06</span>Operação do Monitor</a><a href="#7-executar-o-cypress"><span>07</span>Execução no Cypress</a><a href="#8-etapas-e-critérios-do-teste"><span>08</span>Etapas e critérios do teste</a><a href="#9-resultados-evidências-e-planilha"><span>09</span>Resultados e integridade da LIR</a><a href="#10-recuperar-escrita-pendente"><span>10</span>Recuperação de escrita pendente</a><a href="#11-diagnóstico-de-erros"><span>11</span>Diagnóstico de erros</a><a href="#12-git-e-controle-de-versão"><span>12</span>Git e versionamento</a><a href="#13-configurar-outro-projeto"><span>13</span>Configuração de outro projeto</a><a href="#14-eficiência-manutenção-e-regressão"><span>14</span>Desempenho e regressão</a><a href="#15-histórico-consolidado-e-limites"><span>15</span>Histórico e limites da validação</a><a href="#16-evolução-dos-processos"><span>16</span>Evolução dos processos</a><a href="#matriz"><span>R</span>Matriz de processos</a><a href="#desempenho"><span>D</span>Tempos e desempenho</a></nav><div class="sidebar-footer"><b>Revisão documental 04</b><br>24 de novembro de 2026<br>Branch piloto-11 · código Piloto-12</div></aside>
<main class="page" id="inicio"><div class="toolbar"><div><button class="btn menu" id="menu" aria-controls="sidebar" aria-expanded="false">Sumário</button> Operação / Regras / Desempenho</div><div class="buttons"><button class="btn" id="print">Imprimir / PDF</button></div></div>
<header class="hero"><div class="eyebrow">Manual de operação · Referência de consulta</div><h1>Testes de processo<br>com MES e Siemens S7</h1><p class="lead">Prepare a bancada, acompanhe as transferências e confira as evidências. Procedimentos de operação e recuperação organizados em um único manual.</p><div class="tags"><span class="tag">TRANSPORTE IMPLEMENTADO</span><span class="tag violet">RECEBIMENTO E DOSAGEM EM LEVANTAMENTO</span></div><div class="facts"><div><small>Código funcional</small><b>Piloto-12</b></div><div><small>Monitor S7</small><b>0.13.0</b></div><div><small>Documentação</small><b>Rev04</b></div></div><p class="hero-foot">A branch mantém o nome <strong>piloto-11</strong>. Esta revisão atualiza a documentação e a apresentação.</p></header>
<div class="jump-grid"><a class="jump" href="#2-preparação-e-instalação"><b>01 · Preparar</b><small>Instalação e configurações</small></a><a class="jump" href="#7-executar-o-cypress"><b>02 · Operar</b><small>Runner e critérios de aprovação</small></a><a class="jump" href="#10-recuperar-escrita-pendente"><b>03 · Recuperar</b><small>Pendências e falhas de execução</small></a><a class="jump" href="#matriz"><b>04 · Evoluir</b><small>Regras e consumidores dos módulos</small></a></div>
<div class="notice"><b>Conferência antes de executar</b>Valide CPU, seleção de rotas e LIR. Mantenha uma execução por bancada. O teste pode comandar o MES, escrever a LSH e atualizar a planilha. Após uma interrupção, confirme a restauração e o local vazio.</div>
<div id="search-status" class="search-status" role="status" aria-live="polite" hidden></div><div id="no-results" class="no-results" hidden>Nenhuma seção encontrada. Tente outro termo ou limpe a pesquisa.</div>
<section class="doc-section preparar" aria-label="Estrutura e documentos"><div class="section-label">01 / Operação</div><p><a id="1-estrutura-e-arquivos-preservados"></a></p>
<h2>Estrutura e documentos</h2>
<p>Abra <code>mes-s7-piloto</code> como projeto Cypress. O Monitor é um serviço separado, na pasta <code>monitor-s7</code>. A raiz do repositório reúne a documentação e o verificador integrado.</p>
<table>
<thead>
<tr>
<th>Caminho</th>
<th>Finalidade</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>README.md</code></td>
<td>Apresentação do projeto e acesso rápido aos documentos</td>
</tr>
<tr>
<td><code>MANUAL_OPERACAO.md</code></td>
<td>Procedimentos operacionais desta revisão</td>
</tr>
<tr>
<td><code>documentacao/visual/Piloto_12_Manual_Visual_Rev04.html</code></td>
<td>Manual visual com navegação, pesquisa e impressão</td>
</tr>
<tr>
<td><code>mes-s7-piloto/cypress.config.js</code></td>
<td>Configuração integrada e registro de tarefas</td>
</tr>
<tr>
<td><code>mes-s7-piloto/testes/transferencias/</code></td>
<td>Especificação, orquestração e regras do Transporte</td>
</tr>
<tr>
<td><code>mes-s7-piloto/comum/</code> e <code>comum/s7/</code></td>
<td>Serviços, persistência, catálogo, perfis e comunicação</td>
</tr>
<tr>
<td><code>mes-s7-piloto/scripts/</code></td>
<td>Diagnóstico, resumo, medição e recuperação de planilhas</td>
</tr>
<tr>
<td><code>mes-s7-piloto/planilhas/</code></td>
<td>Local da LIR operacional, fornecida pela instalação</td>
</tr>
<tr>
<td><code>mes-s7-piloto/clp/System/PEData.plf</code></td>
<td>Fonte TIA local, correspondente ao projeto da bancada</td>
</tr>
<tr>
<td><code>mes-s7-piloto/resultados/</code></td>
<td>Eventos, evidências, históricos, backups e controle persistente</td>
</tr>
<tr>
<td><code>mes-s7-piloto/comum/fixtures/</code></td>
<td>Planilhas de regressão; não usar como LIR operacional</td>
</tr>
<tr>
<td><code>monitor-s7/</code></td>
<td>Serviço HTTP, interface e driver S7</td>
</tr>
<tr>
<td><code>.agents/skills/piloto-evolucao-processos/</code></td>
<td>Procedimento de evolução e matriz de processos</td>
</tr>
<tr>
<td><code>verificar-tudo.cjs</code></td>
<td>Regressão do Piloto, do Monitor e da integração simulada</td>
</tr>
<tr>
<td><code>CHANGELOG.md</code></td>
<td>Registro de versões e revisões documentais</td>
</tr>
</tbody>
</table>
<p><strong>Cópia do GitHub:</strong> configurações locais, dependências, resultados, LIR operacional e projeto CLP podem ser excluídos pelo <code>.gitignore</code>. Preserve ou forneça esses recursos na instalação. Não substitua arquivos locais mais recentes por cópias históricas.</p>
<p>Os relatórios e manifestos antigos permanecem como registros de origem. A ausência de um arquivo histórico no checkout não impede o uso dos documentos atuais; consulte a origem indicada em cada registro.</p></section>
<section class="doc-section preparar" aria-label="Preparação e instalação"><div class="section-label">02 / Operação</div><p><a id="2-preparação-e-instalação"></a></p>
<h2>Preparação e instalação</h2>
<p>Use Windows com Node.js 22 ou superior e acesso aos serviços da bancada. A configuração precisa apontar para o MES, o SQL e a CPU de simulação corretos.</p>
<h3>Instalar as dependências</h3>
<p>O <strong>Node.js é instalado uma única vez no computador</strong>. Nesta branch, Piloto e Monitor possuem seus próprios <code>package.json</code> e <code>package-lock.json</code>; as dependências são instaladas em cada subpasta. Não há um instalador npm na raiz.</p>
<p>No PowerShell, a partir da raiz do repositório:</p>
<pre><code class="language-powershell">node --version
Set-Location .\mes-s7-piloto
npm.cmd ci
Set-Location ..\monitor-s7
npm.cmd ci
Set-Location ..
</code></pre>
<p>A instalação pode exigir internet ou caches do npm e do binário Cypress. O repositório não constitui um instalador offline completo. Esta entrega documental não recompila nem fornece um novo executável do Monitor.</p>
<h3>Preparar a instalação</h3>
<ol>
<li>Mantenha a versão anterior disponível para retorno.</li>
<li>Preserve a LIR atual, os resultados, as configurações locais e qualquer pendência de escrita.</li>
<li>Configure os arquivos MES/S7 e o SQL externo, conforme as seções seguintes.</li>
<li>Instale as dependências das duas subpastas.</li>
<li>Inicie o Monitor e faça o diagnóstico antes de selecionar um lote.</li>
</ol>
<p>Na pasta <code>mes-s7-piloto</code>:</p>
<pre><code class="language-powershell">npm.cmd run diagnostico
npm.cmd run diagnostico -- --monitor
</code></pre>
<p>O diagnóstico básico lê configurações, LIR e pendência em disco. A opção <code>--monitor</code> consulta o catálogo HTTP e verifica a disponibilidade da API de diagnóstico com uma lista vazia, sem abrir uma conexão com a CPU. Esses comandos não iniciam transferências, não escrevem no CLP e não validam a conexão SQL. A pré-validação do teste faz a consulta SQL de leitura.</p></section>
<section class="doc-section preparar" aria-label="Configuração MES e SQL"><div class="section-label">03 / Operação</div><p><a id="3-configuração-mes-e-sql"></a></p>
<h2>Configuração MES e SQL</h2>
<h3>Opções de execução</h3>
<p>Configure <code>mes-s7-piloto/execucao.local.json</code>. Use JSON válido, sem comentários. Campos desconhecidos são recusados pelo carregador.</p>
<table>
<thead>
<tr>
<th>Campo</th>
<th>Uso</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>planilha</code></td>
<td>Caminho da LIR dentro de <code>planilhas/</code>, por exemplo <code>planilhas/CL373.00.LIR.04.xlsx</code></td>
</tr>
<tr>
<td><code>urlMes</code></td>
<td>Endereço do MES; a referência da bancada é <code>http://localhost/nexxus-mes</code></td>
</tr>
<tr>
<td><code>usuarioMes</code></td>
<td>Nome do usuário selecionado no login</td>
</tr>
<tr>
<td><code>selecaoRotas</code></td>
<td><code>pendentes</code>, <code>falhas</code>, <code>nao-testadas</code> ou <code>todas</code></td>
</tr>
<tr>
<td><code>modoBusca</code></td>
<td><code>estavel</code>: reconsulta entre caracteres; <code>rapida</code>: preenchimento integral, com verificação e alternativa estável</td>
</tr>
<tr>
<td><code>capturaDesktop</code></td>
<td><code>true</code> mantém a captura desktop Windows; <code>false</code> mantém somente as capturas previstas pelo Cypress</td>
</tr>
<tr>
<td><code>numTestsKeptInMemory</code></td>
<td>Quantidade de testes mantidos em memória, de 0 a 50; referência: 5</td>
</tr>
<tr>
<td><code>esperaBuscaMs</code>, <code>esperaVisualS7Ms</code>, <code>esperaMesSemS7Ms</code></td>
<td>Esperas adicionais entre 0 e 10000 ms; referência: 0</td>
</tr>
</tbody>
</table>
<h3>Credenciais do MES</h3>
<p>O carregador procura <code>credenciais.local.json</code> na raiz do projeto Cypress, ao lado de <code>cypress.config.js</code>. A chave é <strong><code>senhaMES</code></strong>, com essa capitalização. O valor abaixo é apenas um marcador:</p>
<pre><code class="language-json">{
  &quot;senhaMES&quot;: &quot;SUBSTITUA_PELA_SENHA_LOCAL&quot;
}
</code></pre>
<p>Uma senha já fornecida em <code>env.senhaMES</code> tem precedência. O carregador atual reconhece UTF-8 com ou sem BOM e UTF-16 com BOM. Mantenha credenciais fora dos commits, capturas e relatórios. Após alterar a configuração, recarregue o projeto no Cypress; reexecutar somente a spec pode manter os dados anteriores.</p>
<h3>Conexão SQL Server</h3>
<p>O arquivo é externo ao projeto e pertence ao usuário Windows que executa o Cypress:</p>
<pre><code class="language-text">%LOCALAPPDATA%\Nexxus\cypress-clp\sql.local.json
</code></pre>
<p>Se esse arquivo não existir, o módulo pode usar a pasta legada <code>CypressCLP</code>. Variáveis <code>FMS_SQL_*</code> do processo podem prevalecer sobre os valores do arquivo.</p>
<table>
<thead>
<tr>
<th>Campo</th>
<th>Orientação</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>server</code>, <code>database</code>, <code>user</code>, <code>password</code></td>
<td>Servidor, banco e credenciais da instalação</td>
</tr>
<tr>
<td><code>instance</code></td>
<td>Instância nomeada, como <code>SQLEXPRESS</code> na referência da bancada</td>
</tr>
<tr>
<td><code>port</code></td>
<td>Opcional; quando explícita, a instância nomeada não é aplicada</td>
</tr>
<tr>
<td><code>trustServerCertificate</code></td>
<td>Booleano coerente com a política de certificado da instalação</td>
</tr>
<tr>
<td><code>caFile</code></td>
<td>Caminho da CA; quando relativo, é resolvido na pasta da configuração SQL</td>
</tr>
</tbody>
</table>
<p>A conexão utiliza <code>encrypt: true</code>. Na bancada que aceita certificado autoassinado, <code>trustServerCertificate: true</code> dispensa a CA. Essa escolha é da instalação; não deve ser transportada automaticamente para outro ambiente.</p>
<p>A consulta parametrizada cruza <code>dbo.[Rota.Segmento.Equipamento]</code> e <code>dbo.[Equipamento]</code>. O cadastro de silo usa <code>dbo.Silo</code>. O nome da rota, isoladamente, não identifica todos os equipamentos. Preserve o <code>cypress.config.js</code> integrado para manter os registros das tarefas.</p></section>
<section class="doc-section preparar" aria-label="Configuração S7 e critérios"><div class="section-label">04 / Operação</div><p><a id="4-configuração-s7-e-critérios"></a></p>
<h2>Configuração S7 e critérios</h2>
<p>Configure <code>mes-s7-piloto/s7.local.json</code>. O arquivo local não é distribuído pelo Git. Se a mensagem de erro citar <code>s7.exemplo.json</code>, confira sua existência: esse modelo não está presente no checkout de referência desta revisão. Preserve a configuração anterior validada ou prepare uma configuração específica da bancada.</p>
<table>
<thead>
<tr>
<th>Campo</th>
<th>Finalidade</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>habilitado</code></td>
<td><code>true</code> para MES + S7; <code>false</code> para o fluxo MES</td>
</tr>
<tr>
<td><code>codigoRota</code></td>
<td>Número inteiro para uma rota específica; <code>null</code> para lote</td>
</tr>
<tr>
<td><code>monitor</code></td>
<td>URL HTTP local do Monitor, normalmente <code>http://127.0.0.1:3000</code></td>
</tr>
<tr>
<td><code>host</code>, <code>rack</code>, <code>slot</code></td>
<td>CPU e parâmetros da conexão S7</td>
</tr>
<tr>
<td><code>pollMs</code></td>
<td>Ciclo do Monitor; referência da bancada: 200 ms</td>
</tr>
<tr>
<td><code>intervaloConsultaMs</code></td>
<td>Consulta do piloto; referência: 1000 ms</td>
</tr>
<tr>
<td><code>prazoS7Ms</code></td>
<td>Prazo de confirmação S7; referência: 45000 ms</td>
</tr>
<tr>
<td><code>peData</code></td>
<td>Fonte TIA, normalmente <code>clp/System/PEData.plf</code></td>
</tr>
<tr>
<td><code>fonteCatalogo</code></td>
<td><code>automatico</code>, <code>monitor</code> ou <code>arquivo</code>, conforme o fluxo implementado</td>
</tr>
<tr>
<td><code>catalogoId</code></td>
<td>Catálogo explícito ou <code>null</code></td>
</tr>
<tr>
<td><code>modoValidacao</code></td>
<td><code>entradas</code> para retornos de posição; <code>sql</code> para seleção por perfil</td>
</tr>
<tr>
<td><code>tipoContatoLSH</code></td>
<td><code>0</code> para NA; <code>1</code> para NF</td>
</tr>
<tr>
<td><code>incluirLSHNoMonitor</code></td>
<td>Inclui a LSH no mapeamento</td>
</tr>
<tr>
<td><code>escritaManualLSH</code></td>
<td>Habilita a permissão de escrita no ponto mapeado</td>
</tr>
<tr>
<td><code>nivelAlto.habilitado</code></td>
<td>Habilita o ensaio de nível alto nas rotas aplicáveis</td>
</tr>
<tr>
<td><code>nivelAlto.prazoMs</code></td>
<td>Prazo de confirmação; referência: 60000 ms</td>
</tr>
<tr>
<td><code>nivelAlto.offsetsConfirmacao</code></td>
<td>Offsets admitidos; referência do projeto: <code>1.0</code> e <code>1.1</code></td>
</tr>
<tr>
<td><code>nivelAlto.alarmesConfirmados</code></td>
<td>Endereços explicitamente conferidos no projeto</td>
</tr>
<tr>
<td><code>nivelAlto.rearmarRecusaPlcsim</code></td>
<td>Opção explícita para o procedimento de rearme no PLCSIM; desativada por padrão</td>
</tr>
<tr>
<td><code>camposDiagnosticoEquipamentos</code></td>
<td>Nomes completos de campos adicionais do catálogo para diagnóstico</td>
</tr>
</tbody>
</table>
<p>A CPU <code>10.255.11.52</code>, rack 0 e slot 1 é uma referência da bancada anterior, não um padrão universal. Confirme esses dados antes de executar.</p>
<h3>Retornos e perfis</h3>
<p>O SQL continua necessário no modo <code>entradas</code>, pois identifica os vínculos e comandos da rota. No modo <code>sql</code>, <code>perfis-s7.json</code> prioriza a regra por equipamento e depois por tipo. Comando 0 não participa dos retornos de acionamento; comandos 1 e 2 selecionam seus espelhos. Tipos sem regra válida falham explicitamente.</p>
<p>Gavetas com duplo solenoide podem ter saída pulsada. Confirme a posição pelo retorno de entrada quando esse for o critério do perfil; uma saída momentânea não comprova posição mantida.</p>
<h3>Polaridade da LSH</h3>
<table>
<thead>
<tr>
<th><code>tipoContatoLSH</code></th>
<th>Contato</th>
<th>Entrada em nível alto</th>
<th>Entrada normal</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>0</code></td>
<td>NA</td>
<td><code>1 / true</code></td>
<td><code>0 / false</code></td>
</tr>
<tr>
<td><code>1</code></td>
<td>NF</td>
<td><code>0 / false</code></td>
<td><code>1 / true</code></td>
</tr>
</tbody>
</table>
<p>No Monitor, <strong>Aciona</strong> escreve 1 e <strong>Desaciona</strong> escreve 0. Para contato NF, portanto, escrever 0 representa nível alto.</p>
<p>A aprovação do ensaio combina a entrada, <strong>Alm OU Aviso</strong> e a situação <strong>Nível Alto</strong> no MES. Não exige os dois bits digitais simultaneamente. Os offsets <code>1.0</code> e <code>1.1</code> pertencem ao layout de referência e precisam ser conferidos ao mudar de projeto. Não derive DB e offset apenas de um ID.</p>
<h3>Diagnóstico e rearme</h3>
<p>O ponto <code>Silo[X].Niveis.Alto</code> do DB11 é diagnóstico. Seu mapeamento depende de cadastro SQL e layout coerentes; ele não substitui os critérios de aprovação. O diagnóstico de equipamentos usa os endereços confirmados no catálogo e diferencia valores lidos de condições não verificadas.</p>
<p>O rearme no PLCSIM exige habilitação explícita e guardas de estado. A normalização pode envolver uma escrita única ou nenhuma escrita quando os sinais já estão normais. Uma nova recusa encerra a tentativa sem novo rearme. Consulte o <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/docs/PILOTO_11_ESTABILIDADE.md#rearme-após-recusa-de-partida-no-plcsim-60">registro de estabilidade</a> antes de habilitar esse recurso.</p></section>
<section class="doc-section preparar" aria-label="Planilha e seleção de rotas"><div class="section-label">05 / Operação</div><p><a id="5-planilha-e-seleção-de-rotas"></a></p>
<h2>Planilha e seleção de rotas</h2>
<p>Mantenha a LIR operacional em <code>mes-s7-piloto/planilhas/</code> e indique seu caminho em <code>execucao.local.json</code>. Sem seleção explícita, a descoberta precisa encontrar um único candidato operacional. Arquivos temporários do Excel e fixtures de regressão não são a planilha de operação.</p>
<p>A aba usada pelo gravador é <strong>Lista de Rotas - Transferências</strong>. Preserve abas e cabeçalhos. O piloto verifica a identidade da linha e o status antes de gravar.</p>
<table>
<thead>
<tr>
<th>Seleção com <code>codigoRota: null</code></th>
<th>Rotas consideradas</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>pendentes</code></td>
<td>Teste NT/NOK e, quando habilitadas, pendências de nível alto aplicáveis</td>
</tr>
<tr>
<td><code>falhas</code></td>
<td>Teste NOK ou nível alto NOK aplicável</td>
</tr>
<tr>
<td><code>nao-testadas</code></td>
<td>Somente Teste NT</td>
</tr>
<tr>
<td><code>todas</code></td>
<td>Todas as rotas aplicáveis, inclusive as já aprovadas</td>
</tr>
</tbody>
</table>
<p>Use <code>codigoRota: 91</code> para um ensaio específico e <code>codigoRota: null</code> para voltar ao lote. Não use 0 ou string vazia como substituto de <code>null</code>.</p>
<p>Rotas sem IO/ID de nível alto, ou marcadas com <code>---</code> conforme as regras da LIR, podem manter o teste normal e registrar o ensaio de nível alto como não aplicável. Não crie endereços presumidos para preencher lacunas. Consulte os casos detalhados no registro de estabilidade.</p>
<p>Depois de mudar seleção, configuração ou planilha, recarregue o projeto para reconstruir o lote. O watcher fica desativado para evitar reinício involuntário durante a operação.</p></section>
<section class="doc-section operar" aria-label="Operação do Monitor"><div class="section-label">06 / Operação</div><p><a id="6-operar-o-monitor"></a></p>
<h2>Operação do Monitor</h2>
<ol>
<li>Execute <code>monitor-s7/INICIAR_MONITOR.cmd</code> ou, nessa pasta, <code>npm.cmd start</code>. Mantenha o serviço aberto durante o lote.</li>
<li>Acesse a URL exibida no terminal, normalmente <code>http://127.0.0.1:3000</code>.</li>
<li>Confira CPU, rack, slot e estado da conexão. Conectado sem tags indica negociação, não confirmação de leituras.</li>
<li>Abra um catálogo salvo correspondente ao projeto ou importe a pasta TIA com o PEData.</li>
<li>Pesquise por nome, palavras, DB ou endereço e combine os filtros de área, grupo e tipo.</li>
<li>Adicione os pontos e aplique o mapeamento. <strong>Monitorar</strong> e <strong>Permitir escrita</strong> são escolhas por ponto.</li>
<li>Use Cartões ou Tabela conforme a necessidade. O painel do piloto acompanha as tarefas e não depende de um iframe da interface completa.</li>
</ol>
<p>Loopback é a máquina em que o serviço/navegador está em execução; não representa automaticamente o servidor MES. Um catálogo salvo não comprova a versão carregada na CPU nem restabelece a conexão por si só.</p>
<p>Os catálogos ficam em <code>%LOCALAPPDATA%/Nexxus/MonitorS7/catalogos</code>, salvo configuração de <code>MONITOR_S7_DATA_DIR</code>. A fonte PEData e o JSON extraído são persistidos por versão, não por consulta.</p>
<h3>Escrita e endereçamento</h3>
<p>A escrita é pontual, com validação de sessão, qualidade, tipo, faixa, permissão e releitura. Ela não força a entrada ciclicamente; a CPU pode sobrescrever o valor. Para BOOL, os comandos são diretos; números usam editor inline. <code>acknowledged</code> sozinho não equivale a sinal estabilizado: confira <code>verified</code>, <code>observed</code> e a resposta do programa.</p>
<table>
<thead>
<tr>
<th>Endereço no TIA</th>
<th>Sintaxe no Monitor</th>
<th>Interpretação</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>%I34.6</code></td>
<td><code>I34.6</code></td>
<td>Entrada BOOL</td>
</tr>
<tr>
<td><code>DB1149.DBX1.5</code></td>
<td><code>DB1149,X1.5</code></td>
<td>Bit 5 do byte 1</td>
</tr>
<tr>
<td><code>DB5.DBW2</code> como INT</td>
<td><code>DB5,INT2</code></td>
<td>Inteiro no byte 2</td>
</tr>
<tr>
<td><code>DB5.DBD4</code> como REAL</td>
<td><code>DB5,REAL4</code></td>
<td>Real no byte 4</td>
</tr>
</tbody>
</table>
<p>O catálogo PEData pode ser parcial. Confirme área, tipo e offsets no projeto, além das condições de acesso absoluto da CPU da bancada.</p></section>
<section class="doc-section operar" aria-label="Execução no Cypress"><div class="section-label">07 / Operação</div><p><a id="7-executar-o-cypress"></a></p>
<h2>Execução no Cypress</h2>
<p>Na pasta <code>mes-s7-piloto</code>, execute <code>ABRIR_CYPRESS.cmd</code> ou:</p>
<pre><code class="language-powershell">npm.cmd run abrir
</code></pre>
<p>Selecione E2E, o navegador e <code>testes/transferencias/transferencias.cy.js</code>. Confirme a identificação do piloto, o host e as rotas selecionadas antes do lote.</p>
<p>Para execução pelo terminal com navegador visível:</p>
<pre><code class="language-powershell">npm.cmd run executar -- --spec &quot;testes/transferencias/transferencias.cy.js&quot;
</code></pre>
<p><strong>Esse comando opera o ambiente configurado:</strong> pode enviar comandos ao MES, escrever a LSH e atualizar a LIR. Use-o somente com a bancada e a seleção conferidas. Não troque configurações, imports ou tarefas durante um lote ativo.</p>
<p>Para interromper, use Stop e confira os estados MES/S7 antes de uma nova execução. Fechar o Cypress não comprova a restauração de uma escrita enviada.</p></section>
<section class="doc-section operar" aria-label="Etapas e critérios do teste"><div class="section-label">08 / Operação</div><p><a id="8-etapas-e-critérios-do-teste"></a></p>
<h2>Etapas e critérios do teste</h2>
<table>
<thead>
<tr>
<th>Etapa</th>
<th>Ação e condição de aprovação</th>
</tr>
</thead>
<tbody>
<tr>
<td>Pré-validação</td>
<td>Conferir LIR, configuração, pendência, catálogo, LSH e consulta SQL inicial</td>
</tr>
<tr>
<td>Login</td>
<td>Autenticar no MES e preparar a sessão de navegação</td>
</tr>
<tr>
<td>Seleção</td>
<td>Confirmar local, transferência, origem, destino e rota exata</td>
</tr>
<tr>
<td>Preparação S7</td>
<td>Consultar vínculos e selecionar os retornos do perfil</td>
</tr>
<tr>
<td>Partida</td>
<td>Acionar Iniciar e observar os equipamentos sem esperar primeiro a situação Iniciado</td>
</tr>
<tr>
<td>Confirmação</td>
<td>Validar os retornos S7 e a situação no MES; registrar evidências</td>
</tr>
<tr>
<td>Nível alto</td>
<td>Quando aplicável, persistir a intenção, escrever a LSH e confirmar entrada + Alm OU Aviso + MES</td>
</tr>
<tr>
<td>Restauração</td>
<td>Confirmar por releitura o retorno ao valor original antes de liberar a pendência</td>
</tr>
<tr>
<td>Encerramento</td>
<td>Finalizar ou limpar somente o cartão identificado e comprovar o local vazio</td>
</tr>
<tr>
<td>Persistência</td>
<td>Gravar eventos, evidência, histórico e resultado na LIR</td>
</tr>
</tbody>
</table>
<h3>Recusas, impedimentos e recuperação</h3>
<p>A recusa por nível alto deve corresponder ao destino da rota. Preserve a mensagem, a captura e o resultado. Quando as guardas do rearme PLCSIM permitem nova tentativa, ela é única. Uma segunda recusa com S7 normal pode adiar o mesmo destino naquele local até o próximo lote, conforme o fluxo implementado.</p>
<p>O reconhecimento do cartão depende do local e do nome esperado. Situação vazia, <code>+</code> e ícone <code>add</code> não constituem status real. Um cartão encerrado, identificado e sem Parar pode admitir Limpar, confirmação e verificação de local vazio. Cartões ativos, duplicados, de outro nome ou ambíguos não recebem limpeza indiscriminada.</p>
<p>Para cartão Interrompido ou Iniciar desabilitado, o diagnóstico registra condições visíveis e estados S7 confirmados. Informação indisponível permanece não verificada. A limpeza de cartão interrompido exige identidade e condições específicas, descritas no registro de estabilidade; o diagnóstico não transforma uma falha em aprovação.</p>
<p>O <code>afterEach</code> registra o resultado e pode executar a recuperação prevista, com guardas de identidade, execução e restauração. Para uma rota observada em Iniciado, a primeira parada de recuperação pode ser permitida. Isso não autoriza repetição indiscriminada de partida, parada, limpeza ou escrita com resposta incerta. Estado indefinido mantém o bloqueio.</p></section>
<section class="doc-section operar" aria-label="Resultados e integridade da LIR"><div class="section-label">09 / Operação</div><p><a id="9-resultados-evidências-e-planilha"></a></p>
<h2>Resultados e integridade da LIR</h2>
<p>Cada lote possui sua própria pasta em <code>resultados/</code>. Histórico XLSX, capturas, evidência S7 e <code>eventos.jsonl</code> se complementam. O diário registra o recebimento do resultado e, em seguida, a confirmação de persistência. Uma falha de gravação não autoriza o próximo teste silenciosamente.</p>
<p>Na pasta <code>mes-s7-piloto</code>:</p>
<pre><code class="language-powershell">npm.cmd run resumo -- Teste_rotas_Rev00_NOME_DA_EXECUCAO
</code></pre>
<p>O comando cria <code>resumo.json</code>, considera o último resultado por rota e aponta pendências. Ele não reaplica resultados automaticamente a outra LIR. Preserve a planilha e o JSONL para reconciliação.</p>
<h3>Gravação e backups</h3>
<p>O gravador Node, introduzido no 11.4, valida ZIP/XML e trata o defeito conhecido de namespace antes da substituição. Preserva fórmulas, estilos e <code>calcChain</code>; solicita recálculo ao Excel. O gravador PowerShell antigo está desativado. O PowerShell da captura desktop tem outra finalidade.</p>
<p>Os backups ficam em <code>resultados/&lt;execucao&gt;/backups-lir</code>: <code>inicio</code> guarda a primeira versão do lote e <code>anterior</code> a versão imediatamente precedente. Não há uma cópia completa por rota. Hash, marcador Excel/LibreOffice e lock protegem a substituição. Não remova a trava de um gravador ativo.</p>
<h3>Planilha com aviso de reparo</h3>
<ol>
<li>Preserve o original antes de aceitar qualquer reparo do Excel.</li>
<li>Feche Excel e Cypress.</li>
<li>Execute <code>REPARAR_PLANILHA.cmd</code> ou arraste o XLSX sobre esse arquivo.</li>
<li>Abra a cópia gerada em <code>resultados/recuperacao</code> e confira todas as abas.</li>
<li>Troque a planilha ativa somente após conferir o conteúdo. Dados já removidos e salvos pelo Excel exigem original ou backup.</li>
</ol>
<p>Alternativa, na pasta do piloto:</p>
<pre><code class="language-powershell">npm.cmd run recuperar:planilha -- &quot;C:\caminho\arquivo.xlsx&quot;
</code></pre>
<p>O original não é sobrescrito. A contagem histórica de 340 fórmulas pertence à base antiga e não comprova a integridade de qualquer outra planilha.</p></section>
<section class="doc-section recuperar" aria-label="Recuperação de escrita pendente"><div class="section-label">10 / Operação</div><p><a id="10-recuperar-escrita-pendente"></a></p>
<h2>Recuperação de escrita pendente</h2>
<p>O arquivo <code>resultados/controle/escrita-pendente.json</code> registra a intenção antes do comando. Sua remoção depende da normalização ou restauração confirmada, de acordo com o tipo de operação. Uma pendência bloqueia o próximo ensaio; reiniciar o Cypress não a resolve.</p>
<p>Se o Node permanecer ativo, a proteção de prazo tenta a restauração na sessão proprietária 15 segundos após o prazo de nível alto. O resultado é registrado no lote. Essa proteção não envia parada ao MES e não funciona após o término de todo o processo Node.</p>
<h3>Procedimento de conferência</h3>
<ol>
<li>Pare o lote e impeça novas execuções. Preserve o registro, os temporários e as evidências com seus horários.</li>
<li>Confira CPU, endereço, operação e valor esperado. Identifique a transferência exata no MES e coordene seu encerramento com o operador autorizado.</li>
<li>Confirme o sinal por leitura estável na CPU de simulação correta. Para ensaio de nível alto, confira <code>original</code>; para <code>rearme-plcsim</code>, confira <code>destino</code> e Alm/Aviso inativos.</li>
<li>Somente após a conferência, arquive o registro por renomeação, por exemplo <code>escrita-pendente-conferida-DATA.json</code>. Não o apague.</li>
<li>Recarregue o projeto. Se houver nova pendência, investigue o novo registro antes de continuar.</li>
</ol>
<p>Uma falha de <code>rename</code> na fase confirmada pode ocorrer após a releitura da escrita pelo Monitor. Não presuma ausência de escrita a partir de uma falha de arquivo. A ocorrência antiga em <code>I128.4</code>, CPU <code>10.255.11.52</code>, original 1 é apenas um exemplo histórico; o registro da operação corrente é a referência.</p></section>
<section class="doc-section recuperar" aria-label="Diagnóstico de erros"><div class="section-label">11 / Operação</div><p><a id="11-diagnóstico-de-erros"></a></p>
<h2>Diagnóstico de erros</h2>
<table>
<thead>
<tr>
<th>Sintoma</th>
<th>Conferência e ação</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>npm ci</code> falha na raiz</td>
<td>Execute nas subpastas <code>mes-s7-piloto</code> e <code>monitor-s7</code>; não há pacote npm na raiz</td>
</tr>
<tr>
<td><code>ERR_MODULE_NOT_FOUND</code> para <code>@st-one-io/nodes7</code></td>
<td>Instale as dependências em <code>monitor-s7</code> e inicie o serviço dessa versão</td>
</tr>
<tr>
<td><code>s7.local.json</code> ausente</td>
<td>Confira a raiz do projeto Cypress e restaure a configuração validada</td>
</tr>
<tr>
<td>Senha MES ausente</td>
<td>Confira <code>credenciais.local.json</code>, chave <code>senhaMES</code>, extensão real e projeto aberto; recarregue a configuração</td>
</tr>
<tr>
<td><code>fetch failed</code> em catálogo</td>
<td>Verifique serviço, URL, porta e diagnóstico com <code>--monitor</code></td>
</tr>
<tr>
<td>API de diagnóstico retorna 404/405</td>
<td>Encerre o Monitor antigo, inicie o da versão atual e repita o diagnóstico HTTP</td>
</tr>
<tr>
<td>Tarefa não registrada</td>
<td>Confira o projeto e mantenha a configuração integrada com os módulos correspondentes</td>
</tr>
<tr>
<td>Credencial SQL ausente</td>
<td>Confira o arquivo externo do usuário Windows que executa o Cypress</td>
</tr>
<tr>
<td>Certificado SQL recusado</td>
<td>Confira a CA e a política TLS da instalação</td>
</tr>
<tr>
<td>Nenhuma rota selecionada</td>
<td>Confira rota específica, modo de seleção, LIR e pendências reais</td>
</tr>
<tr>
<td>Cartão ausente ou ambíguo</td>
<td>Confira local e identidade; preserve evidências antes de intervir</td>
</tr>
<tr>
<td>Iniciar desabilitado</td>
<td>Preserve a captura e consulte o diagnóstico; resultado continua NOK</td>
</tr>
<tr>
<td>LSH já em nível alto</td>
<td>Confira polaridade, condição da bancada e guardas do rearme PLCSIM</td>
</tr>
<tr>
<td>Nível alto no CLP sem MES</td>
<td>Confira propagação DB11 e atualização MES, conforme o diagnóstico disponível</td>
</tr>
<tr>
<td>Restauração pendente / <code>EPERM</code></td>
<td>Preserve registro e temporários; siga a seção 10 e confira bloqueios/permissões</td>
</tr>
<tr>
<td>Saída de gaveta pulsada</td>
<td>Confira perfil e retorno de posição, sem exigir saída mantida indevidamente</td>
</tr>
<tr>
<td>Falha ao gravar LIR</td>
<td>Feche Excel; confira lock, hash, permissões e diário antes de repetir</td>
</tr>
<tr>
<td>Planilha pede reparo</td>
<td>Gere uma cópia de recuperação; não sobrescreva o original com reparo destrutivo</td>
</tr>
<tr>
<td>Spec ou referência ausente</td>
<td>Confira <code>mes-s7-piloto</code>, <code>specPattern</code> e a integridade dos módulos</td>
</tr>
</tbody>
</table>
<p>Ao relatar um problema, informe rota, etapa, horário, versão, diretório real, erro completo e evidências relevantes. Oculte senhas e dados sensíveis.</p></section>
<section class="doc-section evoluir" aria-label="Git e versionamento"><div class="section-label">12 / Operação</div><p><a id="12-git-e-controle-de-versão"></a></p>
<h2>Git e versionamento</h2>
<p><code>CONFIGURAR_GIT.cmd</code> configura a autoria dos commits no repositório indicado. Confira os valores definidos no utilitário antes de usá-lo com outra pessoa. Sem argumento, ele procura o repositório em <code>mes-s7-piloto</code> e depois na raiz. Não inicializa repositórios, cria commits ou envia arquivos. A autenticação GitHub é independente da autoria.</p>
<p>Antes de registrar alterações, confira:</p>
<pre><code class="language-powershell">git status
git var GIT_AUTHOR_IDENT
</code></pre>
<p>Versione código, lockfiles, exemplos sem segredos e documentação. Revise o <code>.gitignore</code>: adicionar uma regra não remove arquivos já rastreados. Não publique credenciais, configurações locais, dependências ou capturas sem revisão.</p>
<p>Uma revisão documental não altera a versão funcional. O histórico desta revisão está no <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/CHANGELOG.md">changelog</a>. Retornar o código no Git não restaura automaticamente entradas do CLP, banco, resultados ou configurações externas.</p></section>
<section class="doc-section evoluir" aria-label="Configuração de outro projeto"><div class="section-label">13 / Operação</div><p><a id="13-configurar-outro-projeto"></a></p>
<h2>Configuração de outro projeto</h2>
<ol>
<li>Crie uma instalação identificada, mantendo o histórico anterior.</li>
<li>Configure MES, credenciais e SQL da nova instalação.</li>
<li>Forneça a nova LIR e selecione seu caminho explicitamente.</li>
<li>Forneça o PEData correspondente e escolha o catálogo correto.</li>
<li>Confira CPU, perfis, IO/ID, polaridade e layout de DB. Os offsets de referência não são universais.</li>
<li>Resolva pendências do projeto original; não as transporte como configuração do novo projeto.</li>
<li>Faça diagnóstico e regressão. Depois, valide uma rota acompanhada antes do lote.</li>
</ol>
<p>As fixtures CL373 validam o software em cenários conhecidos; não comprovam o cadastro nem o comportamento online de outro projeto. Novas telas ou tipos de equipamento podem exigir critérios e seletores específicos.</p></section>
<section class="doc-section evoluir" aria-label="Desempenho e regressão"><div class="section-label">14 / Operação</div><p><a id="14-eficiência-manutenção-e-regressão"></a></p>
<h2>Desempenho e regressão</h2>
<p>Melhorias de desempenho devem ser medidas sem reduzir os critérios de aprovação, os prazos funcionais ou as evidências obrigatórias. O <a href="#desempenho">estudo do Piloto-12</a> apresenta amostras e candidatos à investigação; não demonstra ganho antes/depois.</p>
<ul>
<li>Mantenha o ciclo do Monitor e o intervalo de consulta coerentes com a bancada.</li>
<li>Reutilize o catálogo correspondente à versão do projeto, sem reutilizar estado operacional antigo.</li>
<li>Priorize seleções pendentes ou com falha quando esse for o objetivo do ensaio.</li>
<li>Use busca rápida somente com estabilidade conferida; preserve a alternativa estável.</li>
<li>Snapshots em memória e vídeo são diferentes das evidências persistidas em disco.</li>
<li><code>capturaDesktop: false</code> retira a visão desktop; não é uma otimização equivalente quando essa evidência é obrigatória.</li>
<li>Arquive somente lotes encerrados e mantenha seus históricos, JSONL e referências. Não compacte ou apague o lote ativo nem <code>resultados/controle</code>.</li>
<li>Gerencie cache Cypress, dependências, catálogos e resultados separadamente.</li>
</ul>
<h3>Regressão isolada</h3>
<p>Na raiz do repositório, com as dependências dos dois projetos instaladas:</p>
<pre><code class="language-powershell">node verificar-tudo.cjs
</code></pre>
<p>Também é possível executar <code>VERIFICAR_REGRESSAO.cmd</code>. Para o piloto isoladamente, execute <code>npm.cmd test</code> em <code>mes-s7-piloto</code>; para conferir o catálogo offline, use <code>npm.cmd run verificar:catalogo</code> nessa mesma pasta, com a fonte configurada.</p>
<p>A regressão usa arquivos temporários e peers locais. Ela não substitui a validação do Windows/Excel nem do MES, SQL e CLP da bancada.</p>
<h3>Dependências</h3>
<p>O <code>package.json</code> atual usa SheetJS <code>xlsx</code> <strong>0.20.3</strong>, por URL do fornecedor. A referência histórica a uma pendência em <code>xlsx</code> 0.18.5 pertence à versão anterior e não descreve a dependência declarada neste checkout. Esta revisão documental não executou uma nova auditoria nem declara ausência de vulnerabilidades. Preserve a origem de cada relatório e evite atualizações forçadas sem regressão da LIR.</p>
<h3>Revisão de versão com as Cypress AI Skills</h3>
<p>Registre commit, versão do Node, resultado por grupo e limites da validação. As skills orientam o trabalho; os testes e evidências sustentam as conclusões.</p>
<table>
<thead>
<tr>
<th>Skill</th>
<th>Aplicação</th>
<th>Evidência esperada</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>$cypress-explain</code></td>
<td>Revisar a intenção, a sequência e as dependências do teste</td>
<td>Condição, tarefa, seletor e comportamento relacionado</td>
</tr>
<tr>
<td><code>$cypress-docs</code></td>
<td>Conferir APIs para a versão instalada</td>
<td>Versão e referência oficial</td>
</tr>
<tr>
<td><code>$cypress-author</code></td>
<td>Criar ou corrigir testes com os helpers existentes</td>
<td>Cenário, asserção e regressão</td>
</tr>
<tr>
<td><code>$cypress-tap</code></td>
<td>Inspecionar a sessão local correta e seu Command Log</td>
<td>PID/sessão, spec, novo início e resultado efetivamente executado</td>
</tr>
</tbody>
</table>
<p>Na máquina com o Cypress aberto, a partir de <code>mes-s7-piloto</code>:</p>
<pre><code class="language-powershell">npx.cmd cypress tap sessions --json
npx.cmd cypress tap status --json
npx.cmd cypress tap reporter
</code></pre>
<p>Com várias sessões, selecione explicitamente a correta por <code>--session</code>, conforme a CLI instalada. Um resultado anterior não comprova uma reexecução. O spec depende do login e da navegação preparados; filtrar somente uma rota pode omitir essa preparação. Não execute novamente um lote ativo para apenas inspecioná-lo.</p>
<p>Referências: <a href="https://docs.cypress.io/app/tooling/ai-skills">Cypress AI Skills</a>, <a href="https://docs.cypress.io/app/tooling/cypress-tap">Cypress Tap</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/docs/PILOTO_11_ESTABILIDADE.md">registro de estabilidade</a>.</p></section>
<section class="doc-section evoluir" aria-label="Histórico e limites da validação"><div class="section-label">15 / Operação</div><p><a id="15-histórico-consolidado-e-limites"></a></p>
<h2>Histórico e limites da validação</h2>
<table>
<thead>
<tr>
<th>Marco</th>
<th>Evolução registrada</th>
</tr>
</thead>
<tbody>
<tr>
<td>Monitor 0.11</td>
<td>Pesquisa combinada, persistência de catálogos e identificação de I/O</td>
</tr>
<tr>
<td>Monitor 0.12 / 0.13</td>
<td>Escrita pontual I/Q/M/DB com permissão e interface direta</td>
</tr>
<tr>
<td>Piloto 10.x</td>
<td>Ensaio de nível alto, polaridade e alternativas Alm/Aviso</td>
</tr>
<tr>
<td>Piloto 11 a 11.3</td>
<td>Persistência, recuperação, identificação de cartões e confirmação do local vazio</td>
</tr>
<tr>
<td>Piloto 11.4</td>
<td>Gravador Node, validação XML, backups e recuperação da LIR em cópia</td>
</tr>
<tr>
<td>Revisões documentais 01 e 02</td>
<td>Consolidação do manual e inclusão da skill de evolução</td>
</tr>
<tr>
<td>Piloto-12</td>
<td>Identificação funcional atual e coletor offline de tempos</td>
</tr>
<tr>
<td>Revisão documental 04</td>
<td>Redação revisada, README de entrada e manual visual; sem mudança funcional</td>
</tr>
</tbody>
</table>
<h3>Evidências históricas</h3>
<p>O registro do commit <code>b5f2168</code>, em 23/11/2026, informa <strong>192 testes aprovados</strong> no Windows com Node 24.22.1: 162 do Piloto, 25 do Monitor e 5 de integração simulada. A contagem 133 dos relatórios antigos pertence ao 11.4 e não deve ser apresentada como resultado da revisão atual.</p>
<p>O documento de estabilidade reúne ocorrências e verificações na VM, com seus limites e pendências. Os recortes de desempenho são parciais e têm seleções distintas; não constituem comparação controlada antes/depois. Esta revisão de apresentação não executou novo ensaio funcional nem confirmou um lote completo da bancada.</p>
<p>Os arquivos <code>VERSOES_INTEGRACAO.json</code>, relatórios e manifestos devem ser lidos com seu contexto de origem. A entrada histórica <code>auditoriaNpm</code> foi preservada como registro anterior; consulte a declaração atual de dependências e faça auditoria específica quando necessário.</p></section>
<section class="doc-section evoluir" aria-label="Evolução dos processos"><div class="section-label">16 / Operação</div><p><a id="16-evolução-dos-processos"></a></p>
<h2>Evolução dos processos</h2>
<p>O Transporte possui regras implementadas T01–T08. Recebimento e Dosagem permanecem <strong>pendentes de levantamento</strong>; compartilhar módulos não comprova equivalência funcional entre processos.</p>
<p>Use a <a href="#matriz">matriz de processos</a> para identificar regras e consumidores. Antes de alterar um módulo comum, confira os pontos de uso e as evidências exigidas. Registre ambiguidades sem inventar critérios.</p>
<p>A skill <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/.agents/skills/piloto-evolucao-processos/SKILL.md"><code>piloto-evolucao-processos</code> v0.1.0</a> orienta essa revisão. Esta entrega preserva integralmente seu conteúdo e a matriz existente. A separação entre infraestrutura, regras compartilhadas comprovadas e regras específicas continua sendo o princípio de desenvolvimento.</p>
<h3>Referências da revisão</h3>
<ul>
<li>Branch: <code>piloto-11</code>.</li>
<li>Commit de origem: <code>7e0f7a4cddb39f244c8be13389c7ec4c59bf0806</code>.</li>
<li>Código funcional: <code>Piloto-12</code>.</li>
<li>Monitor: <code>0.13.0</code>.</li>
<li>Revisão documental: <code>04</code>.</li>
<li>Detalhes e arquivos alterados: <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/documentacao/REVISAO_DOCUMENTAL_Rev04.md">registro da revisão</a>.</li>
</ul></section>
<section class="doc-section evoluir" aria-label="Matriz de processos"><a id="matriz"></a><div class="section-label">Referência / Regras</div><p class="source-note">Conteúdo preservado da matriz existente. Os IDs T01–T08 não foram renumerados.</p><h2>Matriz de processos</h2>
<p>Base observada no código do Piloto 11.4 em 23/11/2026. As regras de Transporte descrevem o fluxo implementado. A matriz de módulos lista consumidores diretos verificados e cobre os pontos de integração principais.</p>
<h2>Transporte</h2>
<table>
<thead>
<tr>
<th>ID</th>
<th>Regra implementada</th>
<th>Fonte</th>
</tr>
</thead>
<tbody>
<tr>
<td>T01</td>
<td>A seleção parte da LIR e da configuração de execução. O spec usa a sessão compartilhada preparada pelos testes de login e navegação.</td>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/cypress.config.js">Configuração Cypress</a>, <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/transferencias.cy.js">ponto de entrada</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/selecao-lir.js">seleção LIR</a></td>
</tr>
<tr>
<td>T02</td>
<td>Selecionar local, transferência, origem, destino e rota exata. A preparação bloqueia diante de transferência ativa ou ambígua. O botão <strong>Iniciar</strong> desabilitado gera captura e, no modo MES + S7, diagnóstico de leitura dos equipamentos.</td>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/rotas-transferencias.js">Orquestração</a>, <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/seguranca-cartoes.js">segurança de cartões</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/impedimento-transferencia.js">diagnóstico no MES</a></td>
</tr>
<tr>
<td>T03</td>
<td>No modo MES + S7, os vínculos SQL, o catálogo e os perfis determinam os retornos esperados. A observação começa após a partida sem aguardar o cartão <strong>Iniciado</strong>. A validação normal exige retorno S7 e confirmação no MES.</td>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/piloto.js">Piloto S7</a>, <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/perfis.js">perfis</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/rotas-transferencias.js">orquestração</a></td>
</tr>
<tr>
<td>T04</td>
<td>Recusa por nível alto deve corresponder ao destino da rota. O rearme exige configuração explícita de PLCSIM e condições verificadas. Quando o fluxo admite nova tentativa, ela é única. Segunda recusa com S7 normal pode adiar o mesmo destino no local até o próximo lote.</td>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/recusa-partida.js">Recusa de partida</a>, <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/rotas-transferencias.js">orquestração</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/nivel-alto.js">controle da LSH</a></td>
</tr>
<tr>
<td>T05</td>
<td>Ensaio aplicável e habilitado exige LSH conforme NA/NF, amostra válida com <code>Alm</code> ou <code>Aviso</code> e cartão <strong>Nível Alto</strong> no MES. O sinal <code>Silo[X].Niveis.Alto</code> no DB11 orienta o diagnóstico quando o cadastro SQL e a leitura puderem ser confirmados.</td>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/nivel-alto.js">Controle da LSH</a>, <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/nivel-alto-mes.js">leitura do cartão</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/consultarRota.js">consulta SQL</a></td>
</tr>
<tr>
<td>T06</td>
<td>Persistir a intenção antes da escrita. Restaurar o valor original com releitura e na sessão proprietária. Uma pendência em disco bloqueia outro ensaio. A proteção de prazo pode atuar enquanto o Node permanece ativo.</td>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/estado-escrita.js">Estado persistente</a>, <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/nivel-alto.js">controle da LSH</a> e <a href="#10-recuperar-escrita-pendente">recuperação operacional</a></td>
</tr>
<tr>
<td>T07</td>
<td>Confirmar liberação do local no MES. A limpeza de uma rota interrompida exige identificação do cartão da rota e diagnóstico. A parada de recuperação depende do mesmo cartão observado em <strong>Iniciado</strong> e das guardas de execução e restauração.</td>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/impedimento-transferencia.js">Diagnóstico e limpeza</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/recuperar-encerramento.js">recuperação de encerramento</a></td>
</tr>
<tr>
<td>T08</td>
<td>Registrar eventos, evidências S7 e histórico Rev 00. A LIR recebe o resultado normal, o nível alto quando aplicável e o resumo dos equipamentos afetados quando houver diagnóstico. O histórico mantém as leituras detalhadas.</td>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/config.js">Tarefas Rev 00</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/testes/transferencias/lir-rotas.js">gravação LIR</a></td>
</tr>
</tbody>
</table>
<h2>Módulos compartilhados e consumidores</h2>
<p>Caminhos relativos a <code>mes-s7-piloto/</code>. O uso compartilhado abaixo foi observado dentro do Piloto. O reaproveitamento por Recebimento e Dosagem está pendente.</p>
<table>
<thead>
<tr>
<th>Módulo</th>
<th>Responsabilidade</th>
<th>Consumidores diretos verificados</th>
<th>Regras</th>
</tr>
</thead>
<tbody>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/execucao.js">execucao.js</a></td>
<td>Carrega as opções de execução.</td>
<td><code>cypress.config.js</code>, <code>scripts/diagnosticar.cjs</code>, <code>scripts/reparar-planilha.cjs</code>, <code>scripts/verificar-catalogo.cjs</code></td>
<td>T01</td>
</tr>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/cartoes-mes.js">cartoes-mes.js</a></td>
<td>Interpreta cartões, comandos e confirmação de local livre.</td>
<td><code>comum/consultas-mes.js</code>, <code>comum/aguardar-transferencias.js</code>, <code>comum/limpar-transferencia.js</code>, <code>comum/impedimento-transferencia.js</code>, <code>comum/recuperar-encerramento.js</code>, <code>testes/transferencias/recusa-partida.js</code>, <code>testes/transferencias/rotas-transferencias.js</code></td>
<td>T02, T04, T07</td>
</tr>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/limpar-transferencia.js">limpar-transferencia.js</a></td>
<td>Conduz a limpeza e confirma o encerramento.</td>
<td><code>comum/impedimento-transferencia.js</code>, <code>testes/transferencias/rotas-transferencias.js</code></td>
<td>T07</td>
</tr>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/cliente-monitor.js">s7/cliente-monitor.js</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/estado-escrita.js">s7/estado-escrita.js</a></td>
<td>Cliente HTTP do Monitor e controle persistente da escrita.</td>
<td>Ambos são usados por <code>comum/s7/piloto.js</code> e <code>scripts/diagnosticar.cjs</code>.</td>
<td>T03, T06</td>
</tr>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/indice-catalogo.js">s7/indice-catalogo.js</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/catalogo-projeto.js">s7/catalogo-projeto.js</a></td>
<td>Indexação, obtenção do catálogo e conferência de sinais.</td>
<td>Ambos são usados por <code>comum/s7/piloto.js</code> e <code>scripts/verificar-catalogo.cjs</code>. O índice também atende <code>comum/s7/nivel-alto.js</code> e <code>comum/s7/gerarRotaCLP.js</code>.</td>
<td>T03, T05</td>
</tr>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/consultarRota.js">s7/consultarRota.js</a></td>
<td>Consulta os vínculos de rota e o cadastro de silo.</td>
<td><code>comum/s7/piloto.js</code> usa <code>consultarRota</code>; <code>cypress.config.js</code> injeta <code>consultarSilo</code>.</td>
<td>T03, T05</td>
</tr>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/nivel-alto.js">s7/nivel-alto.js</a> e <a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/s7/diagnostico-equipamentos.js">s7/diagnostico-equipamentos.js</a></td>
<td>Controles da LSH e leitura de estados dos equipamentos.</td>
<td>Ambos atendem <code>comum/s7/piloto.js</code>. O primeiro também atende <code>cypress.config.js</code> e <code>scripts/verificar-catalogo.cjs</code>; o segundo atende <code>scripts/diagnosticar.cjs</code>.</td>
<td>T02, T04, T05, T06, T07</td>
</tr>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/registro-execucao.js">registro-execucao.js</a></td>
<td>Grava o diário e fornece a classificação das falhas.</td>
<td><code>comum/s7/piloto.js</code> e <code>testes/transferencias/config.js</code></td>
<td>T06, T08</td>
</tr>
<tr>
<td><a href="https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/7e0f7a4cddb39f244c8be13389c7ec4c59bf0806/mes-s7-piloto/comum/gravar-lir.js">gravar-lir.js</a></td>
<td>Atualiza ou recupera a planilha preservando sua estrutura.</td>
<td><code>testes/transferencias/lir-rotas.js</code> e <code>scripts/reparar-planilha.cjs</code></td>
<td>T08</td>
</tr>
</tbody>
</table>
<h2>Recebimento</h2>
<p><strong>Pendente de levantamento.</strong> Confirmar o ponto de entrada do MES, as condições de liberação e encerramento, os vínculos SQL, os sinais de confirmação e os registros esperados. Fonte inicial para a próxima revisão: fluxo operacional e implementação identificada pelo responsável pelo processo.</p>
<h2>Dosagem</h2>
<p><strong>Pendente de levantamento.</strong> Confirmar os gatilhos e estados do ciclo de dosagem, as grandezas e tolerâncias, os vínculos SQL/S7 e a recuperação de ciclo incompleto. Fonte inicial para a próxima revisão: critérios de operação e implementação identificada pelo responsável pelo processo.</p></section>
<section class="doc-section evoluir" aria-label="Tempos e desempenho"><a id="desempenho"></a><div class="section-label">Referência / Desempenho</div><p class="source-note">Estudo de origem preservado. Amostras distintas não demonstram ganho antes/depois.</p><h2>Tempos e desempenho</h2>
<h2>Referência e amostra</h2>
<ul>
<li>Checkout de referência <code>89b1dc7</code> (<strong>Piloto-12</strong>). Antes do trabalho, o índice já continha a exclusão de <code>mes-s7-piloto/execucao.exemplo.json</code>.</li>
<li>Lote <code>Teste_rotas_Rev00_2026-11-23-17-26-17-426</code>, em modo MES + S7. O log informa a versão, sem identificar o commit executado na VM.</li>
<li>Corte no 17º resultado persistido, às 17h31min32s de 23/11/2026 (São Paulo). Das 93 rotas selecionadas, o recorte tem 15 aprovações e duas falhas de partida (703 e 704). A rota aprovada teve mediana de 19,51 s, P90 de 20,59 s e máximo de 21,48 s até o encaminhamento ao registro. As falhas duraram 7,67 s e 8,07 s.</li>
<li>O lote anterior identificado como <code>11</code> registrou 174 de 265 resultados. Esses lotes têm seleções diferentes e ambos os recortes são parciais. Eles não formam uma comparação de desempenho antes/depois.</li>
</ul>
<h2>Medições por etapa</h2>
<p>Tempos em segundos. P90 usa a posição de ordem <code>ceil(0,90 × n)</code>. Os cortes por eventos incluem o trabalho executado entre os marcadores, inclusive a fila do Cypress e o diário. As linhas de preparação e busca se sobrepõem. As medianas de fases não são aditivas.</p>
<table>
<thead>
<tr>
<th>Etapa</th>
<th style="text-align: right;">n</th>
<th style="text-align: right;">Mediana</th>
<th style="text-align: right;">P90</th>
<th>O que foi medido</th>
</tr>
</thead>
<tbody>
<tr>
<td>Login e acesso</td>
<td style="text-align: right;">1</td>
<td style="text-align: right;">2,46</td>
<td style="text-align: right;">2,46</td>
<td>Cronômetro do fluxo até <code>/home</code>. A pré-validação inicial ocorre antes dele.</td>
</tr>
<tr>
<td>Disponibilidade do cartão / campo</td>
<td style="text-align: right;">1 cada</td>
<td style="text-align: right;">0,01 / 0,06</td>
<td style="text-align: right;">0,01 / 0,06</td>
<td>Cronômetros da navegação do lote.</td>
</tr>
<tr>
<td>Preparação da rota</td>
<td style="text-align: right;">15</td>
<td style="text-align: right;">3,92</td>
<td style="text-align: right;">4,48</td>
<td>Selecionar local até verificar <strong>Iniciar</strong>. Inclui busca e preparação S7. A validação inicial da linha da LIR está fora desse intervalo.</td>
</tr>
<tr>
<td>Busca por rota</td>
<td style="text-align: right;">15</td>
<td style="text-align: right;">1,22</td>
<td style="text-align: right;">1,77</td>
<td>Soma dos tempos de preencher, localizar e selecionar. Foram 60 buscas em rotas aprovadas e zero tentativas adicionais.</td>
</tr>
<tr>
<td>Preparação S7</td>
<td style="text-align: right;">15</td>
<td style="text-align: right;">1,78</td>
<td style="text-align: right;">1,83</td>
<td>De <code>Preparar leitura S7</code> a <code>Verificar botão Iniciar</code>. Inclui SQL, mapeamento, Monitor e espera de amostra.</td>
</tr>
<tr>
<td>Partida habilitada</td>
<td style="text-align: right;">15</td>
<td style="text-align: right;">0,22</td>
<td style="text-align: right;">0,25</td>
<td>Da verificação de <strong>Iniciar</strong> ao início do acompanhamento S7. Inclui verificação e clique.</td>
</tr>
<tr>
<td>Retornos S7 e evidências iniciais</td>
<td style="text-align: right;">15</td>
<td style="text-align: right;">2,19</td>
<td style="text-align: right;">3,26</td>
<td>Do início da etapa de acompanhamento S7 até a etapa de confirmação do cartão.</td>
</tr>
<tr>
<td>Amostra de confirmação do S7</td>
<td style="text-align: right;">15</td>
<td style="text-align: right;">1,08</td>
<td style="text-align: right;">2,12</td>
<td>Relógio da evidência S7, da primeira consulta do acompanhamento até a amostra que confirmou os retornos.</td>
</tr>
<tr>
<td>Confirmação <strong>Iniciado</strong> no MES</td>
<td style="text-align: right;">15</td>
<td style="text-align: right;">0,05</td>
<td style="text-align: right;">0,55</td>
<td>Cronômetro após observar os retornos S7.</td>
</tr>
<tr>
<td>Captura inicial do supervisório</td>
<td style="text-align: right;">14</td>
<td style="text-align: right;">0,48</td>
<td style="text-align: right;">0,54</td>
<td>Do marcador de captura ao início do acionamento de nível alto.</td>
</tr>
<tr>
<td>Acionamento da LSH</td>
<td style="text-align: right;">14</td>
<td style="text-align: right;">0,08</td>
<td style="text-align: right;">0,13</td>
<td>Entre o marcador de acionamento e a espera por nível alto.</td>
</tr>
<tr>
<td>Nível alto até a confirmação conjunta</td>
<td style="text-align: right;">14</td>
<td style="text-align: right;">6,48</td>
<td style="text-align: right;">7,45</td>
<td>Da abertura da operação de escrita ao registro da confirmação no CLP e MES, pela evidência S7.</td>
</tr>
<tr>
<td>Primeira amostra positiva de <code>Alm</code> ou <code>Aviso</code> e DB11</td>
<td style="text-align: right;">14 cada</td>
<td style="text-align: right;">5,34</td>
<td style="text-align: right;">5,34</td>
<td>Ambos apareceram na mesma amostra nas 14 rotas. A cadência de leitura limita a precisão do instante em que o CLP mudou.</td>
</tr>
<tr>
<td>Da primeira amostra positiva à confirmação conjunta</td>
<td style="text-align: right;">14</td>
<td style="text-align: right;">1,20</td>
<td style="text-align: right;">2,12</td>
<td>Diferença calculada por rota. Pode incluir atualização do MES, consulta e validação final.</td>
</tr>
<tr>
<td>Evidências após confirmar nível alto</td>
<td style="text-align: right;">14</td>
<td style="text-align: right;">2,05</td>
<td style="text-align: right;">2,08</td>
<td>Do registro da reação ao início da restauração. Inclui renderização, capturas e fila de comandos.</td>
</tr>
<tr>
<td>Restauração da LSH</td>
<td style="text-align: right;">14</td>
<td style="text-align: right;">0,09</td>
<td style="text-align: right;">0,13</td>
<td>Do início da restauração ao marcador de finalização no MES.</td>
</tr>
<tr>
<td>Parada e encerramento no MES</td>
<td style="text-align: right;">15</td>
<td style="text-align: right;">3,71</td>
<td style="text-align: right;">4,75</td>
<td>Cronômetro de finalização até a confirmação final, máximo de 7,67 s.</td>
</tr>
<tr>
<td>Limpeza isolada</td>
<td style="text-align: right;">0</td>
<td style="text-align: right;">—</td>
<td style="text-align: right;">—</td>
<td>O log não delimita o clique, a confirmação e a liberação como intervalo próprio. A limpeza normal, quando ocorre, integra o encerramento.</td>
</tr>
<tr>
<td>Persistência</td>
<td style="text-align: right;">17</td>
<td style="text-align: right;">0,29</td>
<td style="text-align: right;">0,32</td>
<td>Do evento <code>resultado-recebido</code> ao <code>resultado-persistido</code>. Inclui histórico XLSX, atualização e validação da LIR.</td>
</tr>
</tbody>
</table>
<h2>O que os números permitem propor</h2>
<ol>
<li><strong>Evidências e renderização (T03, T05, T08).</strong> O intervalo de evidências após nível alto é de 2,05 s de mediana. O código renderiza a primeira página para obter o total e a renderiza de novo no laço de capturas. A próxima medição pode isolar renderização, screenshot e captura de desktop. Se o segundo render se provar redundante, avaliar reaproveitar apenas a página já renderizada do mesmo resultado, invalidada por nova amostra, página ou desmontagem do painel. A quantidade e o conteúdo das evidências são critérios de equivalência.</li>
<li><strong>Preparação S7 (T03, T05).</strong> Dos 3,92 s da preparação, 1,78 s corresponde ao intervalo de preparação S7. Falta separar consulta de vínculos, consulta do silo, cálculo do mapeamento, conexão e primeira leitura válida. A fonte mostra consultas SQL separadas. Só após medir cada parte, avaliar reaproveitar uma conexão dentro da mesma preparação, com consultas executadas novamente na rota corrente e sem guardar estado operacional para a próxima.</li>
<li><strong>Espera por condição e encerramento (T02–T07).</strong> Nível alto e encerramento são os maiores intervalos, mas contêm condições do processo. A primeira amostra positiva de nível alto só chegou por volta de 5,34 s. Os 1,20 s seguintes misturam atualização do MES e cadência de consulta. A preparação do botão desabilitado tem uma janela funcional de 4 s com reconsultas de 250 ms. O código também consulta por condição na busca e na leitura MES/S7. A configuração local observada tem as três esperas adicionais em zero e consulta S7 de 1.000 ms. Os valores dessa configuração não são registrados no lote. Ainda faltam contagens de consultas e horários separados de parada, diálogo, limpeza e local vazio. Preservar os prazos e as condições.</li>
<li><strong>Persistência (T08).</strong> A mediana de 0,29 s foi pequena neste recorte. O código reabre o histórico e confere a LIR antes e depois de gravar. São pontos mensuráveis, mas checagens de hash, XML, backup e confirmação de gravação protegem a recuperação e devem permanecer. As 60 buscas da amostra também não indicam retrabalho de seleção, então busca e persistência ficam atrás das evidências na ordem de investigação.</li>
</ol>
<p>Nenhuma redução de tempo foi medida. Antes de escolher a primeira mudança, medir o trecho candidato com marcadores locais de início e fim ou com o Command Log quando disponível. Para leituras repetidas, contar por operação, rota e amostra sem registrar payload, credenciais ou valores do CLP. Para limpeza, medir desde a ação autorizada até a confirmação de local vazio e manter a confirmação da parada como marco independente.</p>
<h2>Validação no lote anterior</h2>
<p>O coletor foi executado no lote <code>Teste_rotas_Rev00_2026-11-23-16-20-24-127</code>, registrado como Piloto <code>11</code>. O último evento disponível é de 17h26min03s de 23/11/2026 (São Paulo). O registro contém <strong>174 resultados persistidos de 265 selecionados</strong>, com 172 aprovações e duas falhas. O restante da seleção fica fora do recorte.</p>
<table>
<thead>
<tr>
<th>Etapa</th>
<th style="text-align: right;">n</th>
<th style="text-align: right;">Mediana (s)</th>
<th style="text-align: right;">P90 (s)</th>
</tr>
</thead>
<tbody>
<tr>
<td>Rota aprovada</td>
<td style="text-align: right;">172</td>
<td style="text-align: right;">22,25</td>
<td style="text-align: right;">23,37</td>
</tr>
<tr>
<td>Preparação da rota</td>
<td style="text-align: right;">172</td>
<td style="text-align: right;">5,16</td>
<td style="text-align: right;">5,89</td>
</tr>
<tr>
<td>Busca por rota</td>
<td style="text-align: right;">172</td>
<td style="text-align: right;">1,74</td>
<td style="text-align: right;">2,29</td>
</tr>
<tr>
<td>Preparação S7</td>
<td style="text-align: right;">172</td>
<td style="text-align: right;">1,95</td>
<td style="text-align: right;">2,02</td>
</tr>
<tr>
<td>Retornos S7 e evidências iniciais</td>
<td style="text-align: right;">172</td>
<td style="text-align: right;">3,66</td>
<td style="text-align: right;">3,79</td>
</tr>
<tr>
<td>Confirmação <strong>Iniciado</strong> no MES</td>
<td style="text-align: right;">172</td>
<td style="text-align: right;">0,03</td>
<td style="text-align: right;">0,03</td>
</tr>
<tr>
<td>Nível alto até a confirmação conjunta</td>
<td style="text-align: right;">171</td>
<td style="text-align: right;">5,97</td>
<td style="text-align: right;">7,07</td>
</tr>
<tr>
<td>Evidências após confirmar nível alto</td>
<td style="text-align: right;">171</td>
<td style="text-align: right;">2,77</td>
<td style="text-align: right;">2,97</td>
</tr>
<tr>
<td>Parada e encerramento no MES</td>
<td style="text-align: right;">172</td>
<td style="text-align: right;">2,73</td>
<td style="text-align: right;">3,76</td>
</tr>
<tr>
<td>Persistência</td>
<td style="text-align: right;">174</td>
<td style="text-align: right;">0,30</td>
<td style="text-align: right;">0,33</td>
</tr>
</tbody>
</table>
<p>O login e acesso levaram 3,81 s nesse lote. As 688 buscas das rotas aprovadas ocorreram sem tentativas adicionais registradas. A primeira amostra positiva de <code>Alm</code> ou <code>Aviso</code> e a primeira amostra positiva do DB11 tiveram mediana de 5,69 s. O intervalo calculado por rota da primeira amostra digital positiva à confirmação conjunta teve mediana de 1,26 s. Limpeza continua sem um cronômetro isolado.</p>
<p>A amostra maior sustenta a prioridade de <strong>separar renderização e captura de evidências</strong> (T03, T05, T08). A preparação S7 é o próximo trecho a decompor. As rotas e condições dos dois lotes são diferentes, e o intervalo de evidências inclui várias operações. Os valores observados ainda não demonstram economia com a remoção de uma renderização nem ganho entre versões.</p>
<p>Reprodução offline a partir de <code>mes-s7-piloto</code>:</p>
<pre><code class="language-powershell">node scripts/medir-tempos.cjs Teste_rotas_Rev00_2026-11-23-16-20-24-127
</code></pre>
<h2>Execução controlada e coleta</h2>
<ol>
<li>Na VM de simulação, prepare uma cópia de trabalho com uma cópia da LIR e as configurações locais autorizadas. Selecione uma rota por vez pelo <code>codigoRota</code> de <code>s7.local.json</code>. Use a mesma revisão, estado inicial do MES/CLP, rota, modo de busca, captura e cadência do Monitor em cada repetição. Compare pares equivalentes, com pelo menos três execuções por cenário, identificando sucesso, falha e recuperação. Para recuperação, siga a seção 10 do <a href="#inicio">manual</a>.</li>
<li>O operador executa o spec na máquina da bancada. O comando abaixo <strong>aciona o fluxo normal</strong> no ambiente configurado.</li>
</ol>
<p><code>powershell
   Set-Location .\mes-s7-piloto
   npm.cmd run executar -- --spec "testes/transferencias/transferencias.cy.js"</code></p>
<ol>
<li>Após o encerramento do lote, gere a medição offline pelo nome da pasta. O segundo argumento opcional encerra o recorte no N-ésimo resultado persistido e permite reproduzir esta referência.</li>
</ol>
<p><code>powershell
   node scripts/medir-tempos.cjs Teste_rotas_Rev00_2026-11-23-17-26-17-426 17</code></p>
<p>O coletor lê somente os eventos e a última evidência S7 correspondente a cada rota aprovada e persistida, omite evidências que não podem ser atribuídas a uma tentativa única e imprime agregados no terminal. Ele não modifica o lote nem inicia serviços. As métricas em nível de rota descrevem tentativas registradas, e os tempos de login e navegação aparecem uma única vez por relatório.</p>
<h2>Alterações e reversão</h2>
<p>Esta etapa acrescenta o coletor offline e esta referência, com rastreabilidade nas regras T01–T08 da <a href="#matriz">matriz de processos</a>. A validação desta entrega é leitura de evidências e teste do coletor. A execução funcional e os resultados de bancada permanecem fora da alteração. Para reverter, remova somente o coletor e os registros documentais desta etapa. Nenhuma configuração local ou resultado precisa ser restaurado.</p></section>
<footer class="footer"><strong>Piloto MES e S7 · Rev04</strong><br>Origem: branch piloto-11 · commit 7e0f7a4 · revisão de 24/11/2026. Resultados de testes e medições mantêm a revisão de origem. Esta edição não executou novos ensaios funcionais.<br>Os procedimentos estão incorporados neste arquivo para leitura offline. Links de código e documentos complementares abrem a revisão de origem no GitHub e exigem conexão.</footer></main><button class="to-top" id="top">Voltar ao início ↑</button>
<script>
const sections=[...document.querySelectorAll('.doc-section')];const navLinks=[...document.querySelectorAll('.nav a')];const search=document.getElementById('search');const normal=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
for(const table of document.querySelectorAll('table')){const box=document.createElement('div');box.className='table-wrap';box.tabIndex=0;box.setAttribute('role','region');box.setAttribute('aria-label','Tabela com rolagem horizontal');table.before(box);box.append(table)}
for(const pre of document.querySelectorAll('pre')){const box=document.createElement('div');box.className='code-wrap';pre.before(box);box.append(pre);const label=document.createElement('span');label.className='code-lang';label.textContent=pre.querySelector('code')?.className.replace('language-','')||'Referência';box.append(label);const copy=document.createElement('button');copy.className='copy';copy.textContent='Copiar';copy.setAttribute('aria-label','Copiar bloco de código');box.append(copy);copy.addEventListener('click',async()=>{try{const t=pre.innerText;if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(t)}else{const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();if(!document.execCommand('copy'))throw Error('copy');a.remove()}copy.textContent='Copiado';setTimeout(()=>copy.textContent='Copiar',1800)}catch{copy.textContent='Selecione o texto'}})}
function filter(){const q=normal(search.value.trim());let count=0;for(const s of sections){const yes=!q||normal(s.textContent).includes(q);s.hidden=!yes;if(yes)count++}for(const a of navLinks){const id=decodeURIComponent(a.hash.slice(1));const target=document.getElementById(id);a.hidden=!!target?.closest('.doc-section')?.hidden}const status=document.getElementById('search-status');status.hidden=!q;status.textContent=count+' de '+sections.length+' seções encontradas';document.getElementById('no-results').hidden=count>0}
search.addEventListener('input',filter);document.getElementById('clear').onclick=()=>{search.value='';filter();search.focus()};document.getElementById('print').onclick=()=>{search.value='';filter();window.print()};document.getElementById('top').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.getElementById('menu').onclick=()=>{const yes=document.getElementById('sidebar').classList.toggle('open');document.getElementById('menu').setAttribute('aria-expanded',String(yes))};
for(const a of document.querySelectorAll('a[href^="#"]')){a.addEventListener('click',()=>{search.value='';filter();document.getElementById('sidebar').classList.remove('open');document.getElementById('menu').setAttribute('aria-expanded','false')})}
const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){const anchor=e.target.querySelector('a[id]');navLinks.forEach(a=>a.classList.toggle('active',decodeURIComponent(a.hash.slice(1))===anchor?.id))}}},{rootMargin:'-10% 0px -65% 0px'});sections.forEach(s=>observer.observe(s));
</script></body></html>