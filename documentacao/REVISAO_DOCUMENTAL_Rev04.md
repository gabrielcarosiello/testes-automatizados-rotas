#!/usr/bin/env python3
"""Gera o HTML offline a partir dos documentos da revisão. Requer Python e Markdown."""
from pathlib import Path
from html import escape
from urllib.parse import urljoin
import re
import unicodedata
import markdown

ROOT = Path(__file__).resolve().parent.parent
COMMIT = '7e0f7a4cddb39f244c8be13389c7ec4c59bf0806'
WEB = f'https://github.com/gabrielcarosiello/testes-automatizados-rotas/blob/{COMMIT}/'
SOURCES = [
    ('MANUAL_OPERACAO.md', 'manual', 'Operação'),
    ('.agents/skills/piloto-evolucao-processos/references/matriz-processos.md', 'matriz', 'Regras'),
    ('mes-s7-piloto/docs/DESEMPENHO_PILOTO_12.md', 'desempenho', 'Desempenho'),
]

def slug(s):
    return re.sub(r'[^\w\- ]', '', s.lower()).replace(' ', '-')

def links(html, source):
    def change(m):
        href=m.group(1)
        if href.startswith(('#','http:','https:','mailto:')): return m.group(0)
        target=urljoin(source,href)
        if target.startswith('MANUAL_OPERACAO.md#'):
            href='#'+target.split('#',1)[1]
        elif target=='MANUAL_OPERACAO.md': href='#inicio'
        elif target.split('#')[0]==SOURCES[1][0]: href='#matriz'
        elif target.split('#')[0]==SOURCES[2][0]: href='#desempenho'
        elif target=='documentacao/visual/Piloto_12_Manual_Visual_Rev04.html': href='#inicio'
        else: href=WEB+target
        return 'href="'+escape(href,quote=True)+'"'
    return re.sub(r'href="([^"]+)"',change,html)

nav=[]; sections=[]
for source,prefix,group in SOURCES:
    text=(ROOT/source).read_text(encoding='utf-8')
    if prefix=='manual':
        text=text[text.index('<a id="1-estrutura'):]
        parts=re.split(r'(?=<a id="\d+-)',text)
        for part in parts:
            if not part.strip():continue
            id_=re.search(r'<a id="([^"]+)"',part).group(1)
            title=re.search(r'^## (.+)$',part,re.M).group(1)
            number=int(title.split('.')[0]); title=title.split('. ',1)[1]
            category='preparar' if number<=5 else 'operar' if number<=9 else 'recuperar' if number<=11 else 'evoluir'
            part=re.sub(r'^## .+$','## '+title,part,count=1,flags=re.M)
            body=links(markdown.markdown(part,extensions=['tables','fenced_code']),source)
            sections.append(f'<section class="doc-section {category}" aria-label="{escape(title)}"><div class="section-label">{number:02d} / {group}</div>{body}</section>')
            nav.append(f'<a href="#{id_}"><span>{number:02d}</span>{escape(title)}</a>')
    else:
        title='Matriz de processos' if prefix=='matriz' else 'Tempos e desempenho'
        text=re.sub(r'^# .+$','## '+title,text,count=1,flags=re.M)
        body=links(markdown.markdown(text,extensions=['tables','fenced_code']),source)
        source_note='Conteúdo preservado da matriz existente. Os IDs T01–T08 não foram renumerados.' if prefix=='matriz' else 'Estudo de origem preservado. Amostras distintas não demonstram ganho antes/depois.'
        sections.append(f'<section class="doc-section evoluir" aria-label="{title}"><a id="{prefix}"></a><div class="section-label">Referência / {group}</div><p class="source-note">{source_note}</p>{body}</section>')
        nav.append(f'<a href="#{prefix}"><span>{"R" if prefix=="matriz" else "D"}</span>{title}</a>')

html='''<!doctype html>
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
<label for="search">BUSCAR NO MANUAL</label><div class="search-box"><input id="search" type="search" placeholder="LSH, instalação, regras…" autocomplete="off"><button id="clear" aria-label="Limpar pesquisa">×</button></div><nav class="nav">@@NAV@@</nav><div class="sidebar-footer"><b>Revisão documental 04</b><br>24 de novembro de 2026<br>Branch piloto-11 · código Piloto-12</div></aside>
<main class="page" id="inicio"><div class="toolbar"><div><button class="btn menu" id="menu" aria-controls="sidebar" aria-expanded="false">Sumário</button> Operação / Regras / Desempenho</div><div class="buttons"><button class="btn" id="print">Imprimir / PDF</button></div></div>
<header class="hero"><div class="eyebrow">Manual de operação · Referência de consulta</div><h1>Testes de processo<br>com MES e Siemens S7</h1><p class="lead">Prepare a bancada, acompanhe as transferências e confira as evidências. Procedimentos de operação e recuperação organizados em um único manual.</p><div class="tags"><span class="tag">TRANSPORTE IMPLEMENTADO</span><span class="tag violet">RECEBIMENTO E DOSAGEM EM LEVANTAMENTO</span></div><div class="facts"><div><small>Código funcional</small><b>Piloto-12</b></div><div><small>Monitor S7</small><b>0.13.0</b></div><div><small>Documentação</small><b>Rev04</b></div></div><p class="hero-foot">A branch mantém o nome <strong>piloto-11</strong>. Esta revisão atualiza a documentação e a apresentação.</p></header>
<div class="jump-grid"><a class="jump" href="#2-preparação-e-instalação"><b>01 · Preparar</b><small>Instalação e configurações</small></a><a class="jump" href="#7-executar-o-cypress"><b>02 · Operar</b><small>Runner e critérios de aprovação</small></a><a class="jump" href="#10-recuperar-escrita-pendente"><b>03 · Recuperar</b><small>Pendências e falhas de execução</small></a><a class="jump" href="#matriz"><b>04 · Evoluir</b><small>Regras e consumidores dos módulos</small></a></div>
<div class="notice"><b>Conferência antes de executar</b>Valide CPU, seleção de rotas e LIR. Mantenha uma execução por bancada. O teste pode comandar o MES, escrever a LSH e atualizar a planilha. Após uma interrupção, confirme a restauração e o local vazio.</div>
<div id="search-status" class="search-status" role="status" aria-live="polite" hidden></div><div id="no-results" class="no-results" hidden>Nenhuma seção encontrada. Tente outro termo ou limpe a pesquisa.</div>
@@SECTIONS@@
<footer class="footer"><strong>Piloto MES e S7 · Rev04</strong><br>Origem: branch piloto-11 · commit 7e0f7a4 · revisão de 24/11/2026. Resultados de testes e medições mantêm a revisão de origem. Esta edição não executou novos ensaios funcionais.<br>Os procedimentos estão incorporados neste arquivo para leitura offline. Links de código e documentos complementares abrem a revisão de origem no GitHub e exigem conexão.</footer></main><button class="to-top" id="top">Voltar ao início ↑</button>
<script>
const sections=[...document.querySelectorAll('.doc-section')];const navLinks=[...document.querySelectorAll('.nav a')];const search=document.getElementById('search');const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
for(const table of document.querySelectorAll('table')){const box=document.createElement('div');box.className='table-wrap';box.tabIndex=0;box.setAttribute('role','region');box.setAttribute('aria-label','Tabela com rolagem horizontal');table.before(box);box.append(table)}
for(const pre of document.querySelectorAll('pre')){const box=document.createElement('div');box.className='code-wrap';pre.before(box);box.append(pre);const label=document.createElement('span');label.className='code-lang';label.textContent=pre.querySelector('code')?.className.replace('language-','')||'Referência';box.append(label);const copy=document.createElement('button');copy.className='copy';copy.textContent='Copiar';copy.setAttribute('aria-label','Copiar bloco de código');box.append(copy);copy.addEventListener('click',async()=>{try{const t=pre.innerText;if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(t)}else{const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();if(!document.execCommand('copy'))throw Error('copy');a.remove()}copy.textContent='Copiado';setTimeout(()=>copy.textContent='Copiar',1800)}catch{copy.textContent='Selecione o texto'}})}
function filter(){const q=normal(search.value.trim());let count=0;for(const s of sections){const yes=!q||normal(s.textContent).includes(q);s.hidden=!yes;if(yes)count++}for(const a of navLinks){const id=decodeURIComponent(a.hash.slice(1));const target=document.getElementById(id);a.hidden=!!target?.closest('.doc-section')?.hidden}const status=document.getElementById('search-status');status.hidden=!q;status.textContent=count+' de '+sections.length+' seções encontradas';document.getElementById('no-results').hidden=count>0}
search.addEventListener('input',filter);document.getElementById('clear').onclick=()=>{search.value='';filter();search.focus()};document.getElementById('print').onclick=()=>{search.value='';filter();window.print()};document.getElementById('top').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.getElementById('menu').onclick=()=>{const yes=document.getElementById('sidebar').classList.toggle('open');document.getElementById('menu').setAttribute('aria-expanded',String(yes))};
for(const a of document.querySelectorAll('a[href^="#"]')){a.addEventListener('click',()=>{search.value='';filter();document.getElementById('sidebar').classList.remove('open');document.getElementById('menu').setAttribute('aria-expanded','false')})}
const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){const anchor=e.target.querySelector('a[id]');navLinks.forEach(a=>a.classList.toggle('active',decodeURIComponent(a.hash.slice(1))===anchor?.id))}}},{rootMargin:'-10% 0px -65% 0px'});sections.forEach(s=>observer.observe(s));
</script></body></html>'''
html=html.replace('@@NAV@@',''.join(nav)).replace('@@SECTIONS@@','\n'.join(sections))
out=ROOT/'documentacao/visual/Piloto_12_Manual_Visual_Rev04.html'
out.write_text(html,encoding='utf-8')
print(f'Gerado: {out} ({len(html.encode())} bytes; {len(sections)} seções)')
