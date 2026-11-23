'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mapearCamposDiagnostico, lerDiagnosticoEquipamentos, verificarApiDiagnostico } = require('./diagnostico-equipamentos')

const vinculos = [
  { val_comando: 1, cod_equipamento: 404, des_tag: 'ME06', espelhos_entrada: ['DB1403,X1.5', 'DB1403,X1.6'] },
  { val_comando: 0, cod_equipamento: 999, des_tag: 'IGNORAR', espelhos_entrada: ['DB9,X1.5', 'DB9,X1.6'] },
]
const tag = (name, type, offsetBits) => ({ block: 'EQP404_ME06', dbNumber: 1403, name, type, offsetBits })
const catalogo = [
  tag('Eqp.EquipamentoDWord1.Emergencia', 'BOOL', 22),
  tag('Eqp.Estado', 'INT', 32),
  tag('Eqp.Manutencao', 'BOOL', 23),
  tag('Eqp.Suspenso', 'BOOL', 24),
  tag('Eqp.ComandoEmergencia', 'BOOL', 26),
  tag('Eqp.CodigoCondicao', 'DWORD', 64),
]

test('mapeia campos de status e emergência no DB vinculado à rota com endereços do catálogo', () => {
  const plano = mapearCamposDiagnostico(vinculos, catalogo, ['Eqp.CodigoCondicao'])
  assert.equal(plano.length, 1)
  assert.equal(plano[0].equipamento, 'ME06')
  assert.deepEqual(plano[0].tags.map(t => [t.nome, t.address]), [
    ['Eqp.EquipamentoDWord1.Emergencia', 'DB1403,X2.6'], ['Eqp.Estado', 'DB1403,INT4'],
    ['Eqp.Manutencao', 'DB1403,X2.7'], ['Eqp.Suspenso', 'DB1403,X3.0'], ['Eqp.CodigoCondicao', 'DB1403,DWORD8'],
  ])
})

test('campo ambíguo ou layout não verificado não é lido', () => {
  const [e] = mapearCamposDiagnostico(vinculos, [...catalogo, catalogo[0], { ...tag('Eqp.Falha', 'BOOL', 29), unverifiedLayout: true }])
  assert.deepEqual(e.semEndereco, ['Eqp.EquipamentoDWord1.Emergencia', 'Eqp.Falha'])
  assert.ok(e.tags.every(t => !e.semEndereco.includes(t.nome)))
})

test('consulta Monitor somente com endereços de leitura e registra valores e códigos brutos', async () => {
  const cpu = { host: '127.0.0.1', rack: 0, slot: 1 }
  const equipamentos = mapearCamposDiagnostico(vinculos, catalogo)
  const r = await lerDiagnosticoEquipamentos({ equipamentos, cpu, chamar: async (url, options) => {
    assert.equal(url, '/api/diagnostico-dbs')
    const body = JSON.parse(options.body)
    assert.equal(body.host, cpu.host)
    assert.ok(body.tags.every(t => !('writable' in t)))
    return { host: cpu.host, tags: body.tags.map((t, i) => ({ ...t, good: true, value: [true, 7, true, true][i] })) }
  } })
  assert.equal(r.completo, true)
  assert.match(r.detalhes, /ME06.*Emergencia=true.*Estado=7.*Manutencao=true.*Suspenso=true/)
  assert.match(r.detalhes, /Equipamento em manutenção \(DB1403,X2\.7\)/)
  assert.match(r.detalhes, /Equipamento suspenso \(DB1403,X3\.0\)/)
})

test('identifica a emergência pelo AlarmeEmergencia do DB validado no catálogo', async () => {
  const nome = 'Eqp.EquipamentoAlarmes.AlarmeEmergencia'
  const equipamentos = mapearCamposDiagnostico(vinculos, [
    tag(nome, 'BOOL', 58),
    tag('Eqp.EquipamentoAlarmes.ReconheceAlarmeM_G', 'BOOL', 54),
  ])
  assert.deepEqual(equipamentos[0].tags.map(t => [t.nome, t.address]), [[nome, 'DB1403,X7.2']])
  const cpu = { host: '127.0.0.1' }
  for (const ativo of [true, false]) {
    const leitura = await lerDiagnosticoEquipamentos({ equipamentos, cpu, chamar: async (url, options) => {
      assert.equal(url, '/api/diagnostico-dbs')
      const { tags } = JSON.parse(options.body)
      return { host: cpu.host, tags: tags.map(tag => ({ ...tag, good: true, value: ativo })) }
    } })
    assert.match(leitura.detalhes, new RegExp('AlarmeEmergencia=' + ativo))
    assert.equal(leitura.detalhes.includes('Equipamento em emergência (DB1403,X7.2)'), ativo)
    assert.doesNotMatch(leitura.detalhes, /não verificadas: emergência/)
  }
  const [semLayout] = mapearCamposDiagnostico(vinculos, [{ ...tag(nome, 'BOOL', 58), unverifiedLayout: true }])
  assert.deepEqual(semLayout.tags, [])
  assert.deepEqual(semLayout.semEndereco, [nome])
})

test('CPU divergente, endereço divergente ou ausência de campos preserva diagnóstico incompleto', async () => {
  const cpu = { host: '127.0.0.1' }
  const equipamentos = mapearCamposDiagnostico(vinculos, catalogo)
  const errado = await lerDiagnosticoEquipamentos({ equipamentos, cpu, chamar: async () => ({ host: '127.0.0.2', tags: [] }) })
  assert.equal(errado.completo, false)
  assert.match(errado.detalhes, /outra CPU/)
  const divergente = await lerDiagnosticoEquipamentos({ equipamentos, cpu, chamar: async () => ({
    host: cpu.host, tags: [{ id: equipamentos[0].tags[0].id, address: 'DB1404,X2.6', good: true, value: true }],
  }) })
  assert.equal(divergente.completo, false)
  assert.doesNotMatch(divergente.detalhes, /Emergencia=true/)
  const semCampos = await lerDiagnosticoEquipamentos({ equipamentos: mapearCamposDiagnostico(vinculos, [catalogo[4]]), cpu,
    chamar: async () => assert.fail('consulta sem campo') })
  assert.equal(semCampos.completo, false)
  assert.match(semCampos.detalhes, /não verificadas: emergência, manutenção, suspensão/)
})

test('Monitor anterior à API informa a atualização necessária e mantém o resultado incompleto', async () => {
  const cpu = { host: '127.0.0.1' }
  const equipamentos = mapearCamposDiagnostico(vinculos, catalogo)
  const chamar = async () => { throw Object.assign(new Error('HTTP 405, resposta JSON inválida'), { status: 405 }) }
  const r = await lerDiagnosticoEquipamentos({ equipamentos, cpu, chamar })
  assert.equal(r.completo, false)
  assert.match(r.detalhes, /HTTP 405.*npm start.*monitor-s7/)
  await assert.rejects(verificarApiDiagnostico(chamar), /HTTP 405.*Monitor S7/)
})

test('verifica a API sem enviar CPU ou tags para leitura', async () => {
  await verificarApiDiagnostico(async (url, { body }) => {
    assert.equal(url, '/api/diagnostico-dbs')
    assert.deepEqual(JSON.parse(body), { tags: [] })
    throw Object.assign(new Error('Diagnóstico aceita somente leituras escalares de DB.'), { status: 400 })
  })
})
