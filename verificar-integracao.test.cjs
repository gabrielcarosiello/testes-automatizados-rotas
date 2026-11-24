// Run in the extracted package: node --test verificar-integracao.test.cjs
// Uses a local simulated S7 peer. Never connects to the user's CPU/MES/SQL.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { createServer } = require('node:net')
const { Readable } = require('node:stream')
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises')
const { join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { tmpdir } = require('node:os')
const monitorRoot = resolve(process.env.MONITOR_SOURCE_DIR || join(__dirname, 'monitor-s7'))
const pilotRoot = resolve(process.env.PILOTO_SOURCE_DIR || join(__dirname, 'mes-s7-piloto'))

async function executarEnsaio(automatico, bit = 1, prePartida = null) {
  const { CatalogStore } = await import(pathToFileURL(join(monitorRoot, 'catalog-store.mjs')).href)
  const { simulatedPeer } = await import(pathToFileURL(join(monitorRoot, 'test/helpers/s7-simulated-peer.mjs')).href)
  const { criarPiloto } = require(join(pilotRoot, 'comum/s7/piloto'))
  const directory = await mkdtemp(join(tmpdir(), 'mes-monitor-integracao-'))
  const peer = await simulatedPeer()
  const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(r => listener.close(r))
  const base = `http://127.0.0.1:${port}`
  const store = new CatalogStore(join(directory, 'catalogos'), async () => [
    { block: 'EQP012_RG18', name: 'Eqp.EquipamentoDWord1.EspelhoSaida1', type: 'Bool', dbNumber: 1012, offsetBits: 15 },
    { block: 'DIG031_LSH_MG14', name: 'Dig.str_Dig.Alm', type: 'Bool', dbNumber: 3031, offsetBits: 8 },
    { block: 'Entradas (I)', name: 'LSH_MG14', type: 'Bool', io: true, area: 'I', address: 'I34.6' },
  ])
  const imported = await store.import(Readable.from(['fixture de catálogo para ensaio integrado']), 'Ensaio simulado')
  const processMonitor = spawn(process.execPath, ['server.mjs'], { cwd: monitorRoot, env: { ...process.env, PORT: String(port), MONITOR_S7_PORT: String(peer.port), MONITOR_S7_DATA_DIR: join(directory, 'catalogos') } })
  try {
    await Promise.race([once(processMonitor.stdout, 'data'), once(processMonitor, 'exit').then(([code]) => { throw new Error('Monitor encerrou: ' + code) })])
    const home = await (await fetch(base)).text()
    assert.ok(!home.includes('id="tia-confirm"')); assert.ok(!home.includes('id="write-dialog"'))
    const config = { monitor: base, host: '127.0.0.1', rack: 0, slot: 1, pollMs: 100, fonteCatalogo: 'monitor', tipoContatoLSH: 0, incluirLSHNoMonitor: true, escritaManualLSH: true, nivelAlto: { habilitado: automatico, prazoMs: 5000, rearmarRecusaPlcsim: Boolean(prePartida) } }
    await writeFile(join(directory, 's7.local.json'), JSON.stringify(config))
    await writeFile(join(directory, 'perfis-s7.json'), await readFile(join(pilotRoot, 'perfis-s7.json')))
    const rotas = [{ codigo: '91', destino: 'MG14', nivelAlto: { aplicavel: true, io: 'LSH_MG14', idDigital: 31, status: 'NT' } }]
    const sqlFixture = async () => [{ cod_equipamento: 13, des_tag: 'RG18', tip_equipamento: 1, val_comando: 1, espelhos_entrada: ['DB1012,X1.5', 'DB1012,X1.6'] }]
    const piloto = criarPiloto(directory, sqlFixture, { rotas, consultarSilo: async destino => {
      assert.equal(destino, 'MG14')
      return [{ cod_silo: 12, num_silo_clp: 12, des_string_conexao: 'DB11,INT480' }]
    } })
    assert.equal((await piloto.validarCatalogoS7()).catalogo.id, imported.catalogo.id)
    if (prePartida) {
      await mkdir(join(directory, 'resultados', 'ensaio'), { recursive: true })
      const entradas = peer.bytes(peer.constants.proto.area.INPUTS)
      if (prePartida === 'alto') entradas[34] |= 0x40
      else peer.bytes(peer.constants.proto.area.DB, 3031)[1] |= 0x02
      const preparar = () => piloto.prepararS7({ codigo: 91, pasta: 'ensaio' })
      if (prePartida === 'aviso') {
        await assert.rejects(preparar(), /Nível alto na pré-partida.*LSH_MG14.*Aviso.*LSH normal/)
        assert.equal(peer.writes.length, 0)
      } else {
        const resultado = await preparar()
        assert.equal(resultado.rearme.escrita, true)
        assert.equal(resultado.tags.length, 1)
        assert.equal(entradas[34] & 0x40, 0)
        assert.equal(peer.writes.length, 1)
        assert.match(await readFile(join(directory, 'resultados', 'ensaio', 'eventos.jsonl'), 'utf8'), /Nível alto na pré-partida/)
        await assert.rejects(readFile(join(directory, 'resultados', 'controle', 'escrita-pendente.json')), e => e.code === 'ENOENT')
      }
      return
    }
    const tags = await piloto.prepararS7(91)
    assert.equal(tags.length, 1)
    let snapshot = await (await fetch(base + '/api/tags')).json()
    const lsh = snapshot.tags.find(t => t.id === 'lsh_nivel_alto')
    assert.equal(lsh.address, 'I34.6'); assert.equal(lsh.writeType, 'X'); assert.equal(lsh.value, false)
    const start = Date.now(); peer.bytes(peer.constants.proto.area.DB, 1012)[1] = 0x80
    const deadline = Date.now() + 3000
    do { snapshot = await (await fetch(base + '/api/tags')).json(); if (snapshot.tags[0].value === true) break; await new Promise(r => setTimeout(r, 20)) } while (Date.now() < deadline)
    assert.equal((await piloto.confirmarS7({ inicio: start })).ok, true, 'LSH false permanece separada dos retornos TRUE')
    const writeLsh = async (value, expected) => {
      const response = await fetch(base + '/api/escrita', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'lsh_nivel_alto', connection: snapshot.connection, value, expected }) })
      assert.equal(response.status, 200); return response.json()
    }
    if (automatico) {
      await piloto.acionarNivelAltoS7()
      const pendencia = join(directory, 'resultados', 'controle', 'escrita-pendente.json')
      assert.equal(JSON.parse(await readFile(pendencia, 'utf8')).fase, 'confirmada')
      peer.bytes(peer.constants.proto.area.DB, 3031)[1] = bit
      const limit = Date.now() + 3000
      let reaction
      do { reaction = await piloto.consultarNivelAltoS7(); if (reaction.ok) break; await new Promise(r => setTimeout(r, 20)) } while (Date.now() < limit)
      assert.equal(reaction.ok, true)
      assert.deepEqual([reaction.silo.address, reaction.silo.good, reaction.silo.value], ['DB11,X481.4', true, false])
      peer.bytes(peer.constants.proto.area.DB, 11)[481] |= 0x10
      do { reaction = await piloto.consultarNivelAltoS7(); if (reaction.silo.value === true) break; await new Promise(r => setTimeout(r, 20)) } while (Date.now() < limit)
      assert.equal(reaction.silo.value, true)
      assert.equal((await piloto.confirmarNivelAltoMesS7({ statusMes: 'Nível Alto' })).ok, true)
      assert.equal((await piloto.restaurarNivelAltoS7()).ok, true)
      await assert.rejects(readFile(pendencia), e => e.code === 'ENOENT')
    } else {
      assert.equal((await writeLsh(true, false)).verified, true)
      assert.equal((await writeLsh(false, true)).verified, true)
    }
    const file = piloto.salvarEvidenciaS7({ pasta: 'ensaio' })
    const evidence = JSON.parse(await readFile(join(directory, file), 'utf8'))
    assert.equal(evidence.lshManual.valorInicial, false); assert.equal(evidence.lshManual.ensaioNivelAltoExecutado, automatico)
    if (automatico) {
      assert.equal(evidence.nivelAlto.aprovado, true)
      assert.equal(evidence.nivelAlto.ultima.silo.value, true)
    }
    assert.equal(evidence.catalogoProjeto.catalogo.id, imported.catalogo.id)
    assert.deepEqual(peer.errors, [])
  } finally {
    if (processMonitor.exitCode === null) { const closed = once(processMonitor, 'exit'); processMonitor.kill(); await closed }
    await peer.close(); await rm(directory, { recursive: true, force: true })
  }
}
test('Monitor + Piloto: catálogo salvo, LSH manual e evidência', { timeout: 15000 }, () => executarEnsaio(false))
test('Monitor + Piloto: aciona LSH, confirma Alm/MES simulado e restaura', { timeout: 15000 }, () => executarEnsaio(true))

test('Monitor + Piloto: confirma somente Aviso 1.1 com Alm 1.0 desligado e restaura', { timeout: 15000 }, () => executarEnsaio(true, 2))

test('Monitor + Piloto: rearme de pré-partida escreve uma vez e verifica a entrada normal', { timeout: 15000 }, () => executarEnsaio(true, 1, 'alto'))
test('Monitor + Piloto: Aviso ativo com LSH normal impede partida sem escrita', { timeout: 15000 }, () => executarEnsaio(true, 2, 'aviso'))
