const { test } = require('node:test'), assert = require('node:assert/strict')
const { avaliarResultadoBusca } = require('../../testes/transferencias/resultado-busca')
test('lista vazia da busca anterior não reprova antes do prazo; resultado correto encerra sem espera fixa', () => {
  assert.equal(avaliarResultadoBusca({ correspondencias: 0, vazio: true, agora: 100, prazo: 8000 }), 'aguardar')
  assert.equal(avaliarResultadoBusca({ correspondencias: 1, vazio: false, agora: 200, prazo: 8000 }), 'encontrada')
  assert.equal(avaliarResultadoBusca({ correspondencias: 0, vazio: true, agora: 8000, prazo: 8000 }), 'vazia')
  assert.equal(avaliarResultadoBusca({ correspondencias: 0, vazio: false, agora: 8000, prazo: 8000 }), 'nao-confirmada')
  assert.throws(() => avaliarResultadoBusca({ correspondencias: 2 }), /Mais de uma/)
})
