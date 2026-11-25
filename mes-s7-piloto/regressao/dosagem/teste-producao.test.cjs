const assert = require('node:assert/strict')
const { test } = require('node:test')
const { JSDOM } = require('jsdom')
const { lerTesteProducao } = require('../../testes/dosagem/teste-producao')

function modal(situacao, avisos = '') {
  const linhas = [
    ['1', '34130CP|GR - Milho CG Moído', 'RC49', 'RC06', '100 Kg', situacao],
    ['2', '42490CP|GR - Farelo', 'RC49', 'RC04', '100 Kg', 'Ok'],
    ['3', '56111CG| - Óleo de Soja', 'RC83', 'UT14', '30 Kg', 'Ok'],
  ].map(celulas => '<tr>' + celulas.map(valor => '<td>' + valor + '</td>').join('') + '</tr>').join('')
  return new JSDOM('<section><table>' + linhas + '</table>' + avisos + '</section>').window.document.querySelector('section')
}

test('aprova quando todos os insumos estão Ok e não há impedimentos', () => {
  const resultado = lerTesteProducao(modal('Ok'))
  assert.equal(resultado.aprovado, true)
  assert.equal(resultado.insumos.length, 3)
  assert.equal(resultado.insumos[0].silo, 'RC06')
})

test('mantém o diagnóstico por insumo e consolida mensagens repetidas', () => {
  const mensagem = '1-Nenhum silo com o produto Milho na balança RC49.'
  const resultado = lerTesteProducao(modal('Não Ok', '<div><span>' + mensagem + '</span></div><div>' + mensagem + '</div>'))
  assert.equal(resultado.aprovado, false)
  assert.deepEqual(resultado.impedimentos, [mensagem])
  assert.equal(resultado.insumos[0].situacao, 'Não Ok')
})

test('uma mensagem numerada impede aprovação mesmo com linhas Ok', () => {
  const mensagem = '2-A balança não faz parte da linha Trajeto Rações.'
  const resultado = lerTesteProducao(modal('Ok', '<div>' + mensagem + '</div>'))
  assert.equal(resultado.aprovado, false)
  assert.deepEqual(resultado.impedimentos, [mensagem])
})

test('reconhece as três linhas Ok quando a grade tem células auxiliares', () => {
  const grade = modal('Ok')
  for (const linha of grade.querySelectorAll('tr')) {
    linha.insertAdjacentHTML('afterbegin', '<td aria-hidden="true"></td>')
    linha.insertAdjacentHTML('beforeend', '<td aria-hidden="true"></td>')
  }
  const resultado = lerTesteProducao(grade)
  assert.deepEqual(resultado.insumos.map(insumo => [insumo.ordem, insumo.situacao]), [['1', 'Ok'], ['2', 'Ok'], ['3', 'Ok']])
  assert.equal(resultado.aprovado, true)
})
