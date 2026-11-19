const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { ler } = require('./lir-rotas')
const { selecionarRotas, resumirLir, conferirRotaAtual } = require('./selecao-lir')
const root = path.resolve(__dirname, '../..')

test('LIR.04 real: 91 é reteste explícito; lote seleciona apenas 73 e 74', () => {
  const lir = ler(root, path.join(root, 'comum', 'fixtures', 'LIR_regressao.xlsx'))
  const resumo = resumirLir(lir.rotas)
  assert.equal(resumo.total, 265)
  assert.equal(resumo.teste.OK, 263)
  assert.equal(resumo.nivelAlto.pendentesComSinal, 257)
  const [rota] = selecionarRotas(lir.rotas, { codigoRota: 91 })
  assert.equal(rota.tipoExecucao, 'reteste')
  assert.equal(rota.status, 'OK')
  assert.equal(rota.nivelAlto.status, 'NT')
  assert.deepEqual(selecionarRotas(lir.rotas, { codigoRota: null }).map(r => r.codigo).sort(), ['73', '74'])
  assert.equal(ler(root, path.join(root, 'comum', 'fixtures', 'LIR_regressao.xlsx')).hash, lir.hash)
})

test('distingue rota ausente, não aplicável e código malformado', () => {
  assert.throws(() => selecionarRotas([], { codigoRota: 91 }), /91.*não foi encontrada/)
  assert.throws(() => selecionarRotas([{ codigo: '91', status: '---' }], { codigoRota: 91 }), /não aplicável/)
  for (const codigoRota of [0, -1, 32768, '91', 1.2]) assert.throws(() => selecionarRotas([], { codigoRota }), /inteiro/)
})

test('revalida identidade, Teste e metadados LSH antes de executar e registrar', () => {
  const rota = ler(root, path.join(root, 'comum', 'fixtures', 'LIR_regressao.xlsx')).rotas.find(r => r.codigo === '91')
  assert.equal(conferirRotaAtual([rota], { ...rota, tipoExecucao: 'reteste' }), rota)
  assert.throws(() => conferirRotaAtual([{ ...rota, status: 'NOK' }], rota), /mudaram/)
  assert.throws(() => conferirRotaAtual([{ ...rota, nivelAlto: { ...rota.nivelAlto, io: 'outra' } }], rota), /mudaram/)
  assert.throws(() => conferirRotaAtual([rota], null), /não autorizada/)
})

test('lote de nível alto inclui Teste OK com LSH NT sem confundir os dois resultados', () => {
  const lir = ler(root, path.join(root, 'comum', 'fixtures', 'LIR_regressao.xlsx'))
  const rows = selecionarRotas(lir.rotas, { codigoRota: null, testarNivelAlto: true })
  assert.equal(rows.length, 257)
  assert.ok(rows.some(r => r.codigo === '91' && r.status === 'OK' && r.nivelAlto.status === 'NT'))
  assert.ok(!rows.some(r => r.codigo === '704'))
})

test('seleção configurável e reteste em lote permitem gravar nível alto de rota já OK', () => {
  const nivel = status => ({ aplicavel: true, status })
  const rotas = [{ codigo: '1', status: 'OK', nivelAlto: nivel('NT') }, { codigo: '2', status: 'NOK', nivelAlto: nivel('NOK') }, { codigo: '3', status: 'NT', nivelAlto: nivel('NT') }, { codigo: '4', status: '---', nivelAlto: nivel('NT') }]
  const pendentes = selecionarRotas(rotas, { testarNivelAlto: true })
  assert.equal(pendentes.length, 3)
  assert.equal(pendentes[0].tipoExecucao, 'reteste', 'normal OK não pode ser autorizado como pendente na gravação')
  assert.deepEqual(selecionarRotas(rotas, { modoSelecao: 'falhas' }).map(r => r.codigo), ['2'])
  assert.deepEqual(selecionarRotas(rotas, { modoSelecao: 'nao-testadas' }).map(r => r.codigo), ['3'])
  assert.equal(selecionarRotas(rotas, { modoSelecao: 'todas' }).length, 3)
  assert.equal(selecionarRotas(rotas, { codigoRota: 1, modoSelecao: 'falhas' })[0].codigo, '1')
  assert.throws(() => selecionarRotas(rotas, { modoSelecao: 'qualquer' }), /inválido/)
})
