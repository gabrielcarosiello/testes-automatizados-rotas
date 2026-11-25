const { test } = require('node:test')
const assert = require('node:assert/strict')
const { configurarContatoLSH } = require('../../comum/s7/contato-lsh')

test('0 seleciona NA: entrada 1 para nível alto e 0 sem nível alto', () => {
  assert.deepEqual(configurarContatoLSH(0), {
    tipoContatoLSH: 0, contato: 'NA', valorNivelAlto: true, valorSemNivelAlto: false,
  })
})

test('1 seleciona NF: entrada 0 para nível alto e 1 sem nível alto', () => {
  assert.deepEqual(configurarContatoLSH(1), {
    tipoContatoLSH: 1, contato: 'NF', valorNivelAlto: false, valorSemNivelAlto: true,
  })
})

test('valida número explícito, sem aceitar strings ou booleanos', () => {
  for (const valor of ['0', '1', false, true, null, -1, 2, 0.5, NaN, {}, []]) {
    assert.throws(() => configurarContatoLSH(valor), /tipoContatoLSH.*0.*NA.*1.*NF/)
  }
})

test('arquivo anterior sem campo não presume polaridade', () => {
  assert.equal(configurarContatoLSH(undefined), null)
})
