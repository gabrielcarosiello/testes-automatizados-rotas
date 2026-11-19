const { test } = require('node:test')
const assert = require('node:assert/strict')
const { indiceCatalogo } = require('./indice-catalogo')
const { consultarDbsDaRotaSql } = require('./gerarRotaCLP')
test('índice reutiliza o mesmo catálogo sem esconder duplicidade nem misturar importações', () => {
  const tags = [{ block: 'EQP012_RG18', dbNumber: 1012, name: 'Eqp.X' }, { block: 'EQP012_RG18', dbNumber: 1012, name: 'Eqp.X' }]
  const a = indiceCatalogo(tags); assert.equal(a, indiceCatalogo(tags)); assert.equal(a.campos.values().next().value.length, 2)
  assert.notEqual(a, indiceCatalogo([...tags]))
  const vinculos = [{ des_tag: 'RG18', espelhos_entrada: ['DB1012,X1.5', 'DB1012,X1.6'] }]
  assert.equal(consultarDbsDaRotaSql(vinculos, tags)[0].bloco, 'EQP012_RG18')
  assert.equal(consultarDbsDaRotaSql(vinculos, [...tags, { block: 'outro', dbNumber: 1012 }])[0].bloco, null)
})
