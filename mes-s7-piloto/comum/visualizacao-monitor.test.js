const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { montarPainel, renderizar } = require('./visualizacao-monitor')
const { statusNivelNoMes } = require('./nivel-alto-mes')

test('tabela única usa toda a largura sem quadro/coluna vazia e pagina por altura', () => {
  const dom = new JSDOM('<body></body>')
  try {
    Object.defineProperty(dom.window, 'innerWidth', { value: 1000 }); Object.defineProperty(dom.window, 'innerHeight', { value: 660 })
    montarPainel(dom.window.document, '91')
    const tags = Array.from({ length: 8 }, (_, i) => ({ label: 'EQP' + i, address: 'DB1,X' + i + '.0', good: true, value: true }))
    assert.equal(renderizar(dom.window.document, { tags, ok: true }), 1)
    assert.equal(dom.window.document.querySelectorAll('table').length, 1)
    assert.equal(dom.window.document.querySelector('table').style.width, '100%')
    assert.equal(dom.window.document.querySelectorAll('tr').length, 9)
    assert.ok(renderizar(dom.window.document, { tags: [...tags, ...tags, ...tags, ...tags], ok: true }) > 1)
  } finally { dom.window.close() }
})
test('MES confirma Nível Alto somente no cartão correto e sem Iniciado concomitante', () => {
  const dom = new JSDOM('<div class="row"><div><span>Local</span><span>Transferência</span></div><div class="card-situations">Nível Alto</div></div>')
  try {
    const doc = dom.window.document, visible = () => true
    assert.equal(statusNivelNoMes(doc, 'Transferência', 'Nível Alto', visible), 'Nível Alto')
    assert.equal(statusNivelNoMes(doc, 'Outra', 'Nível Alto', visible), null)
    const status = doc.createElement('div'); status.className = 'card-situations'; status.textContent = 'Iniciado'; doc.querySelector('.row').append(status)
    assert.equal(statusNivelNoMes(doc, 'Transferência', 'Nível Alto', visible), null)
  } finally { dom.window.close() }
})
