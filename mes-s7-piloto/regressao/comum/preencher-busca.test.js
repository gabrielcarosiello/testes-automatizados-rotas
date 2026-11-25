const { test } = require('node:test'), assert = require('node:assert/strict')
const { JSDOM } = require('jsdom'), { preencherBusca } = require('../../comum/preencher-busca')
test('digitação reconsulta campo recriado/desabilitado pelo MES entre caracteres e confirma o valor', async () => {
  const dom = new JSDOM('<input value="antigo">'), doc = dom.window.document
  let consultas = 0, tipos = 0, atualizacao = Promise.resolve()
  class Cadeia {
    constructor(p) { this.p = p }
    should(tipo, valor) { return new Cadeia(this.p.then(el => { if (tipo === 'have.value') assert.equal(el.value, valor); if (tipo === 'be.enabled') assert.equal(el.disabled, false); return el })) }
    and(...args) { return this.should(...args) }
    clear() { return new Cadeia(this.p.then(el => { el.value = ''; return el })) }
    type(texto, opcoes) { return new Cadeia(this.p.then(el => {
      assert.equal(el.isConnected, true, 'elemento anterior não pode ser reutilizado'); assert.equal(el.disabled, false)
      assert.equal(texto.length, 1); assert.equal(opcoes.parseSpecialCharSequences, false); tipos++
      el.value += texto; el.disabled = true
      atualizacao = new Promise(resolve => setTimeout(() => { const novo = el.cloneNode(); novo.value = el.value; novo.disabled = false; el.replaceWith(novo); resolve() }, 1))
      return el
    })) }
    then(resolve, reject) { return this.p.then(resolve, reject) }
  }
  const cy = { get() { consultas++; return new Cadeia(atualizacao.then(() => doc.querySelector('input'))) } }
  try { await preencherBusca({ cy, seletor: 'input', valor: 'RC08' }); assert.equal(doc.querySelector('input').value, 'RC08'); assert.equal(tipos, 4); assert.equal(consultas, 6) } finally { dom.window.close() }
})

test('modo rápido informa o caminho completo em um evento de entrada e relê o campo', async () => {
  const dom = new JSDOM('<input value="antigo">'), doc = dom.window.document
  const entrada = doc.querySelector('input')
  let eventos = 0
  entrada.addEventListener('input', e => {
    eventos++
    assert.equal(e.target.value, 'RG37->RG38->RG11')
    assert.equal(e.inputType, 'insertText')
    const novo = entrada.cloneNode()
    novo.value = entrada.value
    entrada.replaceWith(novo)
  })
  class Cadeia {
    constructor(p) { this.p = p }
    should(tipo, valor) { return new Cadeia(this.p.then(els => {
      if (tipo === 'have.value') assert.equal(els[0].value, valor)
      return els
    })) }
    and(...args) { return this.should(...args) }
    then(resolve, reject) { return this.p.then(resolve, reject) }
  }
  const cy = { get: () => new Cadeia(Promise.resolve([doc.querySelector('input')])) }
  try {
    await preencherBusca({ cy, seletor: 'input', valor: 'RG37->RG38->RG11', modo: 'rapida' })
    assert.equal(eventos, 1)
    assert.equal(doc.querySelector('input').value, 'RG37->RG38->RG11')
  } finally { dom.window.close() }
})
