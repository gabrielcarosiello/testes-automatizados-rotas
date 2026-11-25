const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const { localizarConfirmarProducao, confirmarProducaoHabilitado } = require('../../testes/dosagem/confirmar-producao')

const html = readFileSync(path.join(__dirname, '../fixtures/dosagem/confirmar-producao.html'), 'utf8')
const documento = conteudo => new JSDOM(conteudo).window.document
const localizar = doc => localizarConfirmarProducao(doc, el => !el.closest('[hidden]'))

test('encontra o botão do MES pelo controle, independente do ID', () => {
  const doc = documento(html.replace('id-simulado', 'id-de-outra-sessao'))
  const [botao, ...outros] = localizar(doc)
  assert.equal(botao, doc.querySelector('button'))
  assert.equal(outros.length, 0)
  assert.equal(confirmarProducaoHabilitado(botao), true)
})

test('prioriza o diálogo visível e recusa candidatos ambíguos na spec', () => {
  const doc = documento(html + '<div role="dialog" hidden>' + html + '</div><div role="dialog">' + html + '</div>')
  const modal = doc.querySelector('[role="dialog"]:not([hidden])')
  assert.deepEqual(localizar(doc), [modal.querySelector('button')])
  modal.insertAdjacentHTML('beforeend', html)
  assert.equal(localizar(doc).length, 2)
})

test('distingue botão desabilitado de ausência no diálogo', () => {
  const doc = documento(html + '<div role="dialog">' + html + '</div>')
  const [botao] = localizar(doc)
  botao.disabled = true
  assert.equal(confirmarProducaoHabilitado(botao), false)
  botao.remove()
  assert.deepEqual(localizar(doc), [])
})
