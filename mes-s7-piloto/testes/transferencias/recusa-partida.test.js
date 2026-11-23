const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { detectarRecusaNivelAlto, confirmarLocalVazio, tratarRecusaPartida } = require('./recusa-partida')
const visivel = el => !el.closest('[hidden]')
function fixture({ mensagem = 'Não foi possível iniciar a transferência. O destino RG11 está em nível alto.', ativo = false } = {}) {
  const dom = new JSDOM(`<body><div id="aviso"><h3>Erro</h3><div id="mensagem"></div><button>OK</button></div><p>Não há nenhuma transferência em uso</p></body>`)
  const doc = dom.window.document
  doc.querySelector('#mensagem').textContent = mensagem
  if (ativo) doc.body.insertAdjacentHTML('beforeend', '<div class="row"><div><span>Nome</span><div>Outra transferência</div></div><div class="card-situations">Iniciado</div><button>Parar</button></div>')
  const eventos = []
  const execucao = { pasta: 'lote', atual: { inicioRota: Date.now(), rota: { codigo: '169', destino: 'RG11' }, detalhes: '' }, anterior: { local: 'Armazenagem' }, restauracaoFalhou: false }
  // Executa a função usada pelo Cypress com DOM real e adaptador de comandos local.
  // Não equivale a executar o navegador Cypress/MES no Windows.
  const cy = {
    document: () => Promise.resolve(doc),
    wrap: value => value === null ? Promise.resolve(null) : { click: () => {
      eventos.push('OK'); value.closest('#aviso').remove(); return Promise.resolve()
    } },
    screenshot: nome => { eventos.push('captura'); assert.ok(doc.querySelector('#aviso')); return Promise.resolve(nome) },
    get: () => ({ should: fn => { fn([{ ownerDocument: doc }]); return Promise.resolve() } }),
  }
  const executar = (falharTeste = true) => tratarRecusaPartida({ cy, execucao, visivel, ocultarMonitor: () => { eventos.push('ocultar'); return Promise.resolve() }, falharTeste })
  return { dom, doc, execucao, eventos, executar }
}
test('partida recusada gera falha da rota e libera próxima somente após OK e local vazio', async () => {
  const f = fixture()
  try {
    await assert.rejects(f.executar(), /Partida recusada.*RG11/)
    assert.deepEqual(f.eventos, ['ocultar', 'captura', 'OK'])
    assert.equal(f.execucao.atual.recusaPartida, true)
    assert.equal(f.execucao.anterior, null)
    assert.match(f.execucao.atual.detalhes, /destino RG11.*próxima rota liberada/)
    assert.equal(f.execucao.atual.nivelAltoExecutado, undefined)
    assert.equal(await f.executar(false), null) // afterEach não repete clique/captura.
    assert.equal(f.eventos.length, 3)
  } finally { f.dom.window.close() }
})
test('recuperação no afterEach fecha recusa tardia sem lançar falha do hook', async () => {
  const f = fixture()
  try { assert.equal(await f.executar(false), true); assert.equal(f.execucao.anterior, null) } finally { f.dom.window.close() }
})
test('não libera lote se há transferência ativa apesar de texto vazio na tela', async () => {
  const f = fixture({ ativo: true })
  try { await assert.rejects(f.executar(false), /ausência.*não confirmada/); assert.ok(f.execucao.anterior); assert.equal(f.execucao.atual.recusaPartida, undefined) } finally { f.dom.window.close() }
})
test('restauração pendente não é liberada pelo tratamento do aviso', async () => {
  const f = fixture(); f.execucao.restauracaoFalhou = true
  try { await f.executar(false); assert.ok(f.execucao.anterior); assert.equal(f.execucao.restauracaoFalhou, true) } finally { f.dom.window.close() }
})
for (const mensagem of ['Não foi possível iniciar a transferência. O destino RG08 está em nível alto.', 'Falha de comunicação.', 'Nível Alto', 'Deseja realmente parar a transferência?']) test('não confirma aviso diferente: ' + mensagem, async () => {
  const f = fixture({ mensagem })
  try { assert.equal(await f.executar(false), null); assert.equal(f.eventos.length, 0); assert.ok(f.execucao.anterior) } finally { f.dom.window.close() }
})
test('ignora aviso oculto e rejeita OK ambíguo ou ausente', () => {
  const f = fixture()
  try {
    f.doc.querySelector('#aviso').hidden = true
    assert.equal(detectarRecusaNivelAlto(f.doc, 'RG11', visivel), null)
    f.doc.querySelector('#aviso').hidden = false
    f.doc.querySelector('#aviso').insertAdjacentHTML('beforeend', '<button>OK</button>')
    assert.throws(() => detectarRecusaNivelAlto(f.doc, 'RG11', visivel), /ambíguo/)
    f.doc.querySelectorAll('button').forEach(b => b.remove())
    assert.throws(() => detectarRecusaNivelAlto(f.doc, 'RG11', visivel), /não foi localizado/)
    f.doc.querySelector('p').remove()
    assert.throws(() => confirmarLocalVazio(f.doc, visivel), /não confirmada/)
  } finally { f.dom.window.close() }
})

test('recusa RG11 com as duas frases em linhas separadas é registrada e libera o próximo teste', async () => {
  const f = fixture()
  try {
    const mensagem = f.doc.querySelector('#mensagem')
    mensagem.innerHTML = 'Não foi possível iniciar a transferência.<br>O destino RG11 está em nível alto.'
    assert.match(mensagem.textContent, /transferência\.O destino/)
    await assert.rejects(f.executar(), /Partida recusada.*RG11/)
    assert.deepEqual(f.eventos, ['ocultar', 'captura', 'OK'])
    assert.equal(f.execucao.atual.recusaPartida, true)
    assert.equal(f.execucao.anterior, null)
    assert.match(f.execucao.atual.detalhes, /transferência\. O destino RG11/)
  } finally { f.dom.window.close() }
})
