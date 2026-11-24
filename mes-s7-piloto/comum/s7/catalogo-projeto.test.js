const { test } = require('node:test')
const assert = require('node:assert/strict')
const { criarCatalogoProjeto, conferirSinaisLir } = require('./catalogo-projeto')
const arrays = [{ block: 'Entradas (I)', name: 'LSH_MG14', type: 'Bool', io: true, area: 'I', address: 'I34.6' }]
const data = { catalogo: { id: 'plf-io-1-teste', name: 'Projeto' }, arrays }

test('usa catálogo salvo sem abrir PEData e reutiliza durante o lote', async () => {
  let calls = 0
  const loader = criarCatalogoProjeto('/caminho-sem-arquivos', {}, async route => { calls++; assert.equal(route, '/api/tia/catalogo'); return data })
  assert.equal((await loader.obter()).arrays, arrays)
  assert.equal((await loader.obter()).info.origem, 'monitor')
  assert.equal(calls, 1)
  loader.reiniciar(); await loader.obter(); assert.equal(calls, 2)
})

test('catálogo específico usa seleção por id e bloqueia retorno de outra versão', async () => {
  const loader = criarCatalogoProjeto('/', { fonteCatalogo: 'monitor', catalogoId: data.catalogo.id }, async (route, options) => {
    assert.equal(route, '/api/tia/selecionar'); assert.equal(JSON.parse(options.body).id, data.catalogo.id); return data
  })
  assert.equal((await loader.obter()).info.catalogo.id, data.catalogo.id)
  await assert.rejects(criarCatalogoProjeto('/', { catalogoId: 'outra' }, async () => data).obter(), /não confirmou/)
})

test('não troca de projeto silenciosamente se catálogo estiver danificado ou monitor falhar', async () => {
  await assert.rejects(criarCatalogoProjeto('/', { fonteCatalogo: 'monitor' }, async () => ({ arrays: [] })).obter(), /Nenhum catálogo salvo/)
  await assert.rejects(criarCatalogoProjeto('/', {}, async () => ({ catalogo: {}, arrays: [] })).obter(), /Catálogo salvo inválido/)
  await assert.rejects(criarCatalogoProjeto('/', {}, async () => { throw Object.assign(new Error('falha'), { status: 500 }) }).obter(), /falha/)
  await assert.rejects(criarCatalogoProjeto('/', {}, async () => ({ arrays: [] })).obter(), /Configure peData/)
})

test('identifica LSH por nome, tipo e área sem aprovar ensaio de nível alto', () => {
  const rotas = [{ codigo: '91', nivelAlto: { aplicavel: true, io: 'LSH_MG14', idDigital: 31, status: 'NT' } }]
  const [sinal] = conferirSinaisLir(rotas, arrays)
  assert.equal(sinal.address, 'I34.6'); assert.equal(sinal.ensaioExecutado, false); assert.equal(sinal.statusLir, 'NT')
  assert.equal(conferirSinaisLir(rotas, [])[0].situacao, 'não localizado')
  assert.equal(conferirSinaisLir(rotas, [...arrays, ...arrays])[0].situacao, 'ambíguo')
})
