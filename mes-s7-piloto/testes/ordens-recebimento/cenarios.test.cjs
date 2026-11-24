const { test } = require('node:test')
const assert = require('node:assert/strict')
const { carregarCenarios } = require('./cenarios')
const configurados = require('./cenarios.json')

test('carrega produtos distintos com peso padrão e respeita peso explícito', () => {
  const [milho, farelo] = carregarCenarios([configurados[0], { ...configurados[1], pesoTotalNfKg: 750 }])
  assert.notEqual(milho.codigoProduto, farelo.codigoProduto)
  assert.equal(milho.pesoTotalNfKg, 1000)
  assert.equal(farelo.pesoTotalNfKg, 750)
  assert.throws(() => carregarCenarios([configurados[0], configurados[0]]), /duplicado/)
})
