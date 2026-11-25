const { test } = require('node:test')
const assert = require('node:assert/strict')
const { carregarCenarios } = require('../../testes/ordens-recebimento/cenarios')
const configurados = require('../../testes/ordens-recebimento/cenarios.json')

test('carrega produtos distintos com peso padrão e respeita peso explícito', () => {
  const [milho, farelo] = carregarCenarios([configurados[0], { ...configurados[1], pesoTotalNfKg: 750 }])
  assert.notEqual(milho.codigoProduto, farelo.codigoProduto)
  assert.equal(milho.pesoTotalNfKg, 1000)
  assert.equal(farelo.pesoTotalNfKg, 750)
  assert.throws(() => carregarCenarios([configurados[0], configurados[0]]), /duplicado/)
})

test('Ensacados exige quantidade inteira e calcula o peso total pelo peso unitário', () => {
  const [base] = require('../../testes/ordens-recebimento/cenarios-ensacados.json')
  const [cenario] = carregarCenarios([base], { ensacados: true })
  assert.deepEqual([cenario.quantidade, cenario.pesoUnitarioKg, cenario.pesoTotalNfKg], [10, 25, 250])
  assert.throws(() => carregarCenarios([{ ...base, quantidade: 1.5 }], { ensacados: true }), /quantidade inteira/)
})
