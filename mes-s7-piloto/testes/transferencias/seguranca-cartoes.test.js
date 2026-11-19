const { test } = require('node:test')
const assert = require('node:assert/strict')
const { avaliarCartoes } = require('./seguranca-cartoes')
test('finalização de nível alto permite limpar cartão parado com situação, sem parar outra transferência', () => {
  const info = { vazio: false, cartoes: [{ nome: 'Transferência', quantidadeBotoes: 0, quantidadeLimpar: 1, quantidadeSituacoes: 1 }], nomePermitido: 'Transferência', nivelAltoConfirmado: true }
  assert.equal(avaliarCartoes(info), 'limpar')
  assert.throws(() => avaliarCartoes({ ...info, nivelAltoConfirmado: false }), /não identificado/)
  assert.throws(() => avaliarCartoes({ ...info, nomePermitido: 'Outra' }), /diferente/)
})

for (const exigeAtiva of [false, true]) test(`cartão encerrado com somente Limpar pode finalizar; exigeAtiva=${exigeAtiva}`, () => {
  const info = { vazio: false, cartoes: [{ nome: 'Transferência', quantidadeBotoes: 0, quantidadeLimpar: 1, quantidadeSituacoes: 0 }], nomePermitido: 'Transferência', exigeAtiva }
  assert.equal(avaliarCartoes(info), 'limpar')
  assert.equal(avaliarCartoes({ ...info, somenteLimpar: true }), 'limpar')
  const ativo = { ...info, cartoes: [{ ...info.cartoes[0], quantidadeBotoes: 1, quantidadeSituacoes: 1 }] }
  assert.equal(avaliarCartoes(ativo), 'parar')
  assert.throws(() => avaliarCartoes({ ...ativo, somenteLimpar: true }), /não enviará Parar/)
  assert.throws(() => avaliarCartoes({ ...info, nomePermitido: 'Outra' }), /diferente/)
  assert.throws(() => avaliarCartoes({ ...info, cartoes: [{ ...info.cartoes[0], quantidadeSituacoes: 1 }] }), /não identificado/)
  assert.throws(() => avaliarCartoes({ ...info, cartoes: [{ ...info.cartoes[0], quantidadeLimpar: 2 }] }), /não identificado/)
})
