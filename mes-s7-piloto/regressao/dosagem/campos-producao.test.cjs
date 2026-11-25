const assert = require('node:assert/strict')
const { test } = require('node:test')
const { JSDOM } = require('jsdom')
const { opErpSemPreenchimento, producaoLiberada, localizarRotuloLiberacao } = require('../../testes/dosagem/campos-producao')

function formulario(erp = '') {
  return new JSDOM('<div role="dialog"><div><label>Ordem de Produção</label><input></div>' + erp + '</div>').window.document
}

test('permite confirmar o formulário do MES atualizado sem campo OP ERP', () => {
  assert.equal(opErpSemPreenchimento(formulario(), () => true), true)
})

test('preserva a conferência do campo OP ERP quando a versão do MES o exibe', () => {
  const campo = valor => '<div><label for="op">OP ERP:</label><input id="op" value="' + valor + '"></div>'
  assert.equal(opErpSemPreenchimento(formulario(campo('')), () => true), true)
  assert.equal(opErpSemPreenchimento(formulario(campo('123')), () => true), false)
})

test('lê o selo Liberado do MES mesmo com uma coluna posterior à Situação', () => {
  const doc = new JSDOM('<table><tr><td>76958</td><td><div class="container-status"><div class="color" style="background-color: rgb(255, 255, 128)">Liberado</div></div><span>Detalhes</span></td><td><span class="color">Outro indicador</span></td></tr></table>').window.document
  const linha = doc.querySelector('tr')
  const visivel = el => !el.closest('[hidden]')
  assert.equal(producaoLiberada(linha, visivel), true)
  linha.querySelector('.color').hidden = true
  assert.equal(producaoLiberada(linha, visivel), false)
  linha.querySelector('.color').hidden = false
  linha.querySelector('.color').textContent = 'Realizando'
  assert.equal(producaoLiberada(linha, visivel), false)
})

test('encontra Liberada para Produção no dxbl-check com comentários e espaços do MES', () => {
  const doc = new JSDOM(
    '<div role="tabpanel"><div class="filter-toolbar">' +
    '<dxbl-check class="dxbl-checkbox dxbl-checkbox-unchecked" check-state="2">' +
    '<div class="dxbl-checkbox-check-element"><input type="checkbox" id="id-simulado"></div>' +
    '<label for="id-simulado" class="dxbl-text"><!--!-->\n Liberada para Produção<!--!-->\n</label></dxbl-check>' +
    '<dxbl-check><input id="outro" type="checkbox"><label for="outro">Destino Intercalado</label></dxbl-check></div></div>'
  ).window.document
  const rotulos = localizarRotuloLiberacao(doc.querySelector('[role="tabpanel"]'), () => true)
  assert.equal(rotulos.length, 1)
  assert.equal(rotulos[0].control, doc.getElementById('id-simulado'))
})

test('reconhece a partida pelo passo, produção, lote e batelada sem depender do cabeçalho', () => {
  const { passosAtivosDaProducao } = require('../../testes/dosagem/campos-producao')
  const doc = new JSDOM('<table><tr><td>1 - Dosagem Bal. RC49</td><td>1795638162845</td>' +
    '<td>76963</td><td>1</td><td>CY-2511 - CYPRESS RAC</td><td>ME01</td>' +
    '<td><span class="color">Rodando</span><span>+</span></td></tr></table>').window.document
  const identidade = { producao: '76963', lote: '1795638162845', destino: 'ME01' }
  assert.deepEqual(passosAtivosDaProducao(doc, identidade, () => true), [
    { passo: '1 - Dosagem Bal. RC49', batelada: '1', destino: 'ME01', situacao: 'Rodando' },
  ])
  assert.deepEqual(passosAtivosDaProducao(doc, { ...identidade, producao: '76964' }, () => true), [])
  doc.querySelector('.color').textContent = 'Vazio'
  assert.deepEqual(passosAtivosDaProducao(doc, identidade, () => true), [])
})

test('o acompanhamento conserva situação interrompida e rejeita outra produção', () => {
  const { lerPassosDaProducao } = require('../../testes/dosagem/campos-producao')
  const doc = new JSDOM('<table><tr><td>2 - Pulmão RC49</td><td>1795638162845</td>' +
    '<td>76963</td><td>17</td><td>CYPRESS RAC</td><td>ME01</td>' +
    '<td><span>Interrompido</span><span>+</span></td></tr></table>').window.document
  const identidade = { producao: '76963', lote: '1795638162845', destino: 'ME01' }
  assert.deepEqual(lerPassosDaProducao(doc, identidade, () => true), [
    { passo: '2 - Pulmão RC49', batelada: '17', destino: 'ME01', situacoes: ['Interrompido'] },
  ])
  assert.deepEqual(lerPassosDaProducao(doc, { ...identidade, producao: '76964' }, () => true), [])
})

test('lê a quantidade de bateladas formatada pelo MES', () => {
  const { lerContagemBateladas } = require('../../testes/dosagem/campos-producao')
  assert.equal(lerContagemBateladas('1.000'), 1000)
  assert.equal(lerContagemBateladas('1000'), 1000)
  assert.equal(lerContagemBateladas('0'), 0)
  assert.ok(Number.isNaN(lerContagemBateladas('1.00')))
  assert.ok(Number.isNaN(lerContagemBateladas('')))
})
