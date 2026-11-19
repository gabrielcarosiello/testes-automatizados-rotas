const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createServer } = require('node:http')
const { mkdtemp, rm, writeFile, readFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { criarPiloto, mapear, diagnostico } = require('./piloto')

const vinculo = { cod_equipamento: 13, tip_equipamento: 1, des_tag: 'RG18', val_comando: 1, espelhos_entrada: ['DB1012,X1.5', 'DB1012,X1.6'] }
const campo = 'Eqp.EquipamentoDWord1.EspelhoSaida1'
const catalogo = [{ block: 'EQP012_RG18', name: campo, dbNumber: 1012, type: 'Bool', offsetBits: 15 }]

test('mapeia comandos 1 e 2, ignora 0 e falha com um espelho pendente', () => {
  const segundo = { ...vinculo, val_comando: 2 }
  const catalogoCompleto = [...catalogo, { ...catalogo[0], name: campo.replace(/1$/, '2'), offsetBits: 0 }]
  assert.deepEqual(mapear([vinculo, segundo, { val_comando: 0 }], catalogoCompleto).map(t => t.address),
    ['DB1012,X1.7', 'DB1012,X0.0'])
  assert.throws(() => mapear([vinculo, segundo], catalogo), /RG18.*EspelhoSaida2/)
  assert.throws(() => mapear([vinculo], [{ ...catalogo[0], offsetBits: null }]), /offset/)
  assert.throws(() => mapear([{ ...vinculo, val_comando: 3 }], catalogo), /fora de/)
})

test('diferencia amostra válida, simulação e retorno ausente ou inválido', () => {
  const [tag] = mapear([vinculo], catalogo)
  const amostra = { connected: true, state: 'ok', mode: 's7', sequence: 1, receivedAt: new Date().toISOString(),
    tags: [{ ...tag, good: true, value: true }] }
  assert.equal(diagnostico(amostra, [tag], true), '')
  assert.match(diagnostico({ ...amostra, mode: 'demo' }, [tag], true), /Aguardando/)
  assert.match(diagnostico({ ...amostra, tags: [] }, [tag], true), /RG18.*inválido/)
  assert.match(diagnostico(amostra, [tag], false), /esperado false, lido true/)
})

test('importa, arma, aguarda amostra nova e devolve erro se a sessão mudar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mes-s7-'))
  const chamadas = []
  let tags
  let connection = 'bancada:0'
  let sequence = 0
  let ligado = false
  const server = createServer(async (req, res) => {
    chamadas.push(req.url)
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/tia/catalogo') {
      res.end(JSON.stringify({ arrays: [], catalogo: null }))
    } else if (req.url === '/api/tia/importar') {
      assert.equal(req.headers['content-type'], 'application/octet-stream')
      assert.equal(body.toString(), 'PEData de teste')
      res.end(JSON.stringify({ arrays: catalogo }))
    } else if (req.url === '/api/conexao') {
      assert.ok(req.headers.origin)
      tags = JSON.parse(body).tags
      res.end(JSON.stringify({ connection, host: '127.0.0.2' }))
    } else {
      res.end(JSON.stringify({ connection, sequence: ++sequence, connected: true, mode: 's7', state: 'ok',
        receivedAt: new Date().toISOString(), tags: tags.map(t => ({ ...t, good: true, value: ligado })) }))
    }
  })
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    await writeFile(join(dir, 'PEData.plf'), 'PEData de teste')
    await writeFile(join(dir, 's7.local.json'), JSON.stringify({
      monitor: `http://127.0.0.1:${server.address().port}`, host: '127.0.0.2', rack: 0, slot: 1, pollMs: 200, peData: 'PEData.plf',
    }))
    await writeFile(join(dir, 'perfis-s7.json'), await readFile(join(__dirname, '../../perfis-s7.json')))
    const piloto = criarPiloto(dir, async codigo => {
      assert.equal(codigo, 91)
      return [vinculo]
    })
    assert.equal((await piloto.prepararS7('91')).length, 1)
    ligado = true
    const confirmado = await piloto.confirmarS7()
    assert.equal(confirmado.ok, true)
    assert.match(confirmado.detalhe, /amostra 2/)
    assert.deepEqual(chamadas, ['/api/tia/catalogo', '/api/tia/importar', '/api/conexao', '/api/tags', '/api/tags'])
    ligado = false
    await piloto.prepararS7('91')
    connection = 'outra:0'
    assert.equal((await piloto.confirmarS7()).ok, false)
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})

test('registra pulso anterior sem aprovar saídas que ligaram em momentos diferentes', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'mes-s7-pulso-'))
  const segundo = { ...vinculo, des_tag: 'RG25', val_comando: 2 }
  const arrays = [...catalogo, { ...catalogo[0], name: campo.replace(/1$/, '2'), offsetBits: 0 }]
  let tags = []
  let sequence = 0
  let valores = [false, false]
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/tia/catalogo') res.end(JSON.stringify({ arrays: [], catalogo: null }))
    else if (req.url === '/api/tia/importar') res.end(JSON.stringify({ arrays }))
    else if (req.url === '/api/conexao') {
      tags = JSON.parse(Buffer.concat(chunks)).tags
      res.end(JSON.stringify({ connection: 'teste:0', host: '127.0.0.2' }))
    } else {
      res.end(JSON.stringify({ connection: 'teste:0', sequence: ++sequence, connected: true,
        mode: 's7', state: 'ok', receivedAt: new Date().toISOString(),
        tags: tags.map((tag, i) => ({ ...tag, good: true, value: valores[i] })),
      }))
    }
  })
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    await writeFile(join(dir, 'PEData.plf'), 'teste')
    await writeFile(join(dir, 's7.local.json'), JSON.stringify({
      monitor: `http://127.0.0.1:${server.address().port}`, host: '127.0.0.2',
      rack: 0, slot: 1, pollMs: 200, peData: 'PEData.plf', prazoS7Ms: 1000, tipoContatoLSH: 1,
    }))
    await writeFile(join(dir, 'perfis-s7.json'), await readFile(join(__dirname, '../../perfis-s7.json')))
    const piloto = criarPiloto(dir, async () => [vinculo, segundo])
    await piloto.prepararS7(91)
    valores = [true, false]
    const primeira = await piloto.confirmarS7()
    assert.equal(primeira.ok, false)
    assert.equal(primeira.concluido, false)
    valores = [false, true]
    const segunda = await piloto.confirmarS7()
    assert.equal(segunda.ok, false)
    assert.ok(segunda.tags.every(tag => tag.jaLigou))
    const agora = Date.now()
    t.mock.method(Date, 'now', () => agora + 1500)
    const final = await piloto.confirmarS7()
    assert.equal(final.concluido, true)
    assert.equal(final.ok, false)
    assert.match(final.detalhe, /já foi true.*pulso/)
    const arquivo = await piloto.salvarEvidenciaS7({ pasta: 'ensaio' })
    const evidencia = JSON.parse(await readFile(join(dir, arquivo), 'utf8'))
    assert.equal(evidencia.vinculosSql.length, 2)
    assert.deepEqual(evidencia.contatoLSH, { tipoContatoLSH: 1, contato: 'NF', valorNivelAlto: false, valorSemNivelAlto: true })
    assert.equal(evidencia.resultado.ok, false)
    assert.ok(evidencia.historico.length >= 3)
    assert.equal(evidencia.observadas.s7_1.jaLigou, true)
  } finally {
    t.mock.restoreAll()
    await new Promise(resolve => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})

test('Monitor 0.11: pré-valida catálogo e LSH, prepara/valida sem PEData e registra versão na evidência', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mes-s7-salvo-'))
  const chamadas = []
  let tags = [], sequence = 0, ligado = false
  const catalogoSalvo = { id: 'plf-io-1-' + 'a'.repeat(64), name: 'Projeto em uso', sourceSha256: 'a'.repeat(64), parserVersion: 'plf-io-1' }
  const io = { block: 'Entradas (I)', name: 'LSH_MG14', type: 'Bool', area: 'I', io: true, address: 'I34.6' }
  const server = createServer(async (req, res) => {
    chamadas.push(req.url); const chunks = []; for await (const chunk of req) chunks.push(chunk)
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/tia/catalogo') res.end(JSON.stringify({ arrays: [...catalogo, io], catalogo: catalogoSalvo }))
    else if (req.url === '/api/conexao') {
      tags = JSON.parse(Buffer.concat(chunks)).tags; res.end(JSON.stringify({ connection: 'salvo:0', host: '127.0.0.2' }))
    } else if (req.url === '/api/tags') res.end(JSON.stringify({ connection: 'salvo:0', sequence: ++sequence, connected: true, mode: 's7', state: 'ok', receivedAt: new Date().toISOString(), tags: tags.map(t => ({ ...t, good: true, value: ligado })) }))
    else { res.statusCode = 404; res.end(JSON.stringify({ error: 'Operação não esperada neste teste' })) }
  })
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    await writeFile(join(dir, 's7.local.json'), JSON.stringify({ monitor: `http://127.0.0.1:${server.address().port}`, host: '127.0.0.2', rack: 0, slot: 1, pollMs: 200, fonteCatalogo: 'monitor', tipoContatoLSH: 0 }))
    await writeFile(join(dir, 'perfis-s7.json'), await readFile(join(__dirname, '../../perfis-s7.json')))
    const piloto = criarPiloto(dir, async () => [vinculo], { rotas: [{ codigo: '91', nivelAlto: { aplicavel: true, io: 'LSH_MG14', idDigital: 31, status: 'NT' } }] })
    const preflight = await piloto.validarCatalogoS7()
    assert.equal(preflight.sinaisLir[0].address, 'I34.6')
    assert.equal(preflight.sinaisLir[0].ensaioExecutado, false)
    await piloto.prepararS7(91); ligado = true; assert.equal((await piloto.confirmarS7()).ok, true)
    const arquivo = piloto.salvarEvidenciaS7({ pasta: 'ensaio' })
    const evidencia = JSON.parse(await readFile(join(dir, arquivo), 'utf8'))
    assert.equal(evidencia.catalogoProjeto.catalogo.id, catalogoSalvo.id)
    assert.equal(evidencia.sinaisLir[0].statusLir, 'NT')
    ligado = false; await piloto.prepararS7(91)
    assert.equal(chamadas.filter(url => url === '/api/tia/catalogo').length, 1)
    assert.equal(chamadas.includes('/api/tia/importar'), false)
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }) }
})

test('LSH manual acompanha a conexão sem entrar no critério TRUE dos equipamentos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mes-s7-lsh-manual-'))
  let submitted, sequence = 0
  let equipmentValue = false, lshValue = false
  let connections = 0
  const io = { block: 'Entradas (I)', name: 'LSH_MG14', type: 'Bool', area: 'I', io: true, address: 'I34.6' }
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/tia/catalogo') res.end(JSON.stringify({ arrays: [...catalogo, io], catalogo: { id: 'lsh-manual' } }))
    else if (req.url === '/api/conexao') { connections++; submitted = JSON.parse(Buffer.concat(chunks)); res.end(JSON.stringify({ connection: 'manual:0', host: '127.0.0.2', tags: submitted.tags.map(t => ({ ...t, writeType: t.writable ? 'X' : null })) })) }
    else res.end(JSON.stringify({ connection: 'manual:0', sequence: ++sequence, receivedAt: new Date().toISOString(), connected: true, mode: 's7', state: 'ok', tags: submitted.tags.map(t => ({ ...t, good: true, value: t.id === 'lsh_nivel_alto' ? lshValue : equipmentValue })) }))
  })
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const config = { monitor: `http://127.0.0.1:${server.address().port}`, host: '127.0.0.2', rack: 0, slot: 1, pollMs: 200, fonteCatalogo: 'monitor', tipoContatoLSH: 0, incluirLSHNoMonitor: true, escritaManualLSH: true }
    const rotas = [{ codigo: '91', nivelAlto: { aplicavel: true, io: 'LSH_MG14', idDigital: 31, status: 'NT' } }]
    await writeFile(join(dir, 's7.local.json'), JSON.stringify(config))
    await writeFile(join(dir, 'perfis-s7.json'), await readFile(join(__dirname, '../../perfis-s7.json')))
    const piloto = criarPiloto(dir, async () => [vinculo], { rotas })
    assert.equal((await piloto.prepararS7(91)).length, 1)
    assert.equal(submitted.tags.length, 2)
    assert.equal(submitted.tags[1].writable, true)
    equipmentValue = true
    assert.equal((await piloto.confirmarS7()).ok, true, 'LSH false não impede confirmação dos equipamentos')
    const file = piloto.salvarEvidenciaS7({ pasta: 'ensaio' })
    const evidence = JSON.parse(await readFile(join(dir, file), 'utf8'))
    assert.equal(evidence.lshManual.valorInicial, false)
    assert.equal(evidence.lshManual.ensaioNivelAltoExecutado, false)
    equipmentValue = false; lshValue = true
    await assert.rejects(piloto.prepararS7(91), /já indica nível alto/)
    lshValue = false
    const missing = criarPiloto(dir, async () => [vinculo], { rotas: [{ ...rotas[0], nivelAlto: { ...rotas[0].nivelAlto, io: 'ausente' } }] })
    const before = connections
    await assert.rejects(missing.prepararS7(91), /não localizado/)
    assert.equal(connections, before)
    await writeFile(join(dir, 's7.local.json'), JSON.stringify({ ...config, rack: 8 }))
    assert.throws(() => criarPiloto(dir), /rack deve/)
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }) }
})

test('SQL indisponível é detectado na pré-validação antes de conectar/escrever no CLP', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'preflight-sql-')), chamadas = []
  const server = createServer((req, res) => { chamadas.push(req.method + ' ' + req.url); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ arrays: catalogo, catalogo: { id: 'preflight' } })) })
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r))
    await writeFile(join(dir, 's7.local.json'), JSON.stringify({ monitor: `http://127.0.0.1:${server.address().port}`, host: '127.0.0.2', rack: 0, slot: 1, pollMs: 200, fonteCatalogo: 'monitor' }))
    const p = criarPiloto(dir, async () => { throw new Error('SQL indisponível de teste') }, { rotas: [{ codigo: '91' }], prevalidarSql: true })
    await assert.rejects(p.validarCatalogoS7(), /SQL: verificação inicial.*indisponível/)
    assert.deepEqual(chamadas, ['GET /api/tia/catalogo'])
  } finally { await new Promise(r => server.close(r)); await rm(dir, { recursive: true, force: true }) }
})
