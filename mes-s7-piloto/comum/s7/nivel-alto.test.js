const { test } = require('node:test')
const assert = require('node:assert/strict')
const { configuracaoNivel, resolverAlarme, criarControleNivel } = require('./nivel-alto')
const { configurarContatoLSH } = require('./contato-lsh')
const rota = { codigo: '91', nivelAlto: { aplicavel: true, io: 'LSH_MG14', idDigital: 31, status: 'NT' } }
const record = { block: 'DIG031_LSH_MG14', name: 'Dig.str_Dig.Alm', type: 'Bool', dbNumber: 3031, offsetBits: 8 }

test('resolve Alm por DB DIG/nome/ID sem fórmula de número do DB e usa o layout configurado quando o offset não foi resolvido', () => {
  const cfg = configuracaoNivel({ nivelAlto: { habilitado: true } })
  assert.equal(resolverAlarme(rota, [record], cfg).address, 'DB3031,X1.0')
  const suggested = { ...record, offsetBits: undefined, unverifiedLayout: true, suggestedOffsetBits: 8 }
  const layout = resolverAlarme(rota, [{ ...suggested, suggestedOffsetBits: 99 }], cfg)
  assert.equal(layout.address, 'DB3031,X1.0')
  assert.equal(layout.alternativas[0].address, 'DB3031,X1.1')
  assert.equal(layout.origem, 'layout-de-confirmacao-configurado')
  const confirmed = configuracaoNivel({ nivelAlto: { habilitado: true, alarmesConfirmados: { LSH_MG14: 'DB3031,X1.0' } } })
  assert.equal(resolverAlarme(rota, [suggested], confirmed).origem, 'confirmado-na-configuracao')
  assert.throws(() => resolverAlarme(rota, [record], { ...confirmed, alarmesConfirmados: { LSH_MG14: 'DB999,X1.0' } }), /diverge/)
})

function fixture(tipo = 0, registrarProtecao) {
  const contato = configurarContatoLSH(tipo)
  const c = { connection: 's:0', resultado: { ok: true }, lsh: { id: 'lsh', label: 'LSH', address: 'I34.6', valorInicial: contato.valorSemNivelAlto }, alarme: { id: 'alm', label: 'Alm', address: 'DB3031,X1.0' } }
  const state = { entrada: contato.valorSemNivelAlto, alm: false, aviso: false, connection: 's:0', errorWrite: false, writes: [] }
  let sequence = 0
  const cfg = configuracaoNivel({ nivelAlto: { habilitado: true, prazoMs: 1000 } })
  const controls = criarControleNivel({ getContext: () => c, contato, cfg, pollMs: 100, registrarProtecao, chamar: async (route, options) => {
    if (route === '/api/escrita') {
      const cmd = JSON.parse(options.body); state.writes.push(cmd)
      state.entrada = cmd.value
      if (state.errorWrite) throw new Error('resposta perdida')
      return { acknowledged: true, verified: true, observed: state.entrada }
    }
    return { connection: state.connection, mode: 's7', connected: true, state: 'ok', sequence: ++sequence, receivedAt: new Date().toISOString(), tags: [{ ...c.lsh, good: true, value: state.entrada }, { ...c.alarme, good: true, value: state.alm }, ...(c.alarme.alternativas || []).map(t => ({ ...t, good: state.avisoGood !== false, value: state.aviso }))] }
  } })
  return { c, state, controls, contato }
}
for (const tipo of [0, 1]) test(`aciona NA/NF=${tipo}, exige Alm + MES e restaura o valor original`, async () => {
  const { c, state, controls, contato } = fixture(tipo)
  await controls.acionarNivelAltoS7()
  assert.equal(state.entrada, contato.valorNivelAlto)
  assert.equal((await controls.consultarNivelAltoS7()).ok, false)
  await assert.rejects(controls.confirmarNivelAltoMesS7({ statusMes: 'Nível Alto' }), /não foram confirmados/)
  state.alm = true
  await assert.rejects(controls.confirmarNivelAltoMesS7({ statusMes: 'Iniciado' }), /não foram confirmados/)
  assert.equal((await controls.confirmarNivelAltoMesS7({ statusMes: 'Nível Alto' })).ok, true)
  assert.equal(c.nivel.aprovado, false)
  assert.equal((await controls.restaurarNivelAltoS7()).ok, true)
  assert.equal(state.entrada, contato.valorSemNivelAlto)
  assert.equal(c.nivel.aprovado, true)
  assert.equal(state.writes.length, 2)
  assert.equal((await controls.restaurarNivelAltoS7()).necessario, false)
})
test('proteção restaura uma vez após o prazo sem chamada do navegador', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  const eventos = []
  const { c, state, controls } = fixture(0, (contexto, resultado) => eventos.push([contexto, resultado]))
  await controls.acionarNivelAltoS7()
  t.mock.timers.tick(15999)
  assert.equal(state.writes.length, 1)

  t.mock.timers.tick(1)
  const restaurado = await controls.restaurarNivelAltoS7()
  assert.deepEqual(restaurado, { ok: true, necessario: true, valor: false })
  assert.deepEqual(eventos, [[c, restaurado]])
  assert.deepEqual(state.writes.map(c => c.value), [true, false])
  assert.equal(c.nivel.aprovado, false)
})

test('proteção preserva a pendência sem escrever quando a sessão mudou', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  const eventos = []
  const { c, state, controls } = fixture(0, (_contexto, resultado) => eventos.push(resultado))
  await controls.acionarNivelAltoS7()
  state.connection = 'outra'
  t.mock.timers.tick(16000)
  assert.equal((await controls.restaurarNivelAltoS7()).ok, false)
  assert.match(eventos[0].detalhe, /Sessão ou leitura atualizada/)
  assert.equal(c.nivel.restauracaoPendente, true)
  assert.equal(state.writes.length, 1)
})

test('não aciona antes de confirmar equipamentos, não repete e restaura após perda de resposta', async () => {
  const { c, state, controls } = fixture()
  c.resultado.ok = false
  await assert.rejects(controls.acionarNivelAltoS7(), /equipamentos/)
  c.resultado.ok = true; state.errorWrite = true
  await assert.rejects(controls.acionarNivelAltoS7(), /resposta perdida/)
  assert.equal(c.nivel.restauracaoPendente, true)
  await assert.rejects(controls.acionarNivelAltoS7(), /já foi solicitado/)
  state.errorWrite = false
  assert.equal((await controls.restaurarNivelAltoS7()).ok, true)
  assert.equal(state.entrada, false)
})
test('entrada que não permanece, timeout e mudança de sessão não aprovam nem escrevem em outro alvo', async t => {
  const { c, state, controls } = fixture()
  await controls.acionarNivelAltoS7(); state.entrada = false
  assert.equal((await controls.consultarNivelAltoS7()).concluido, true)
  state.entrada = true; state.alm = true
  c.nivel.limite = Date.now() - 1
  const expirado = await controls.consultarNivelAltoS7()
  assert.equal(expirado.ok, false)
  assert.equal(expirado.concluido, true)
  assert.equal(expirado.confirmadoClp, true)
  state.alm = false
  assert.equal((await controls.consultarNivelAltoS7()).confirmadoClp, false)
  state.connection = 'outra'
  const count = state.writes.length
  assert.equal((await controls.restaurarNivelAltoS7()).ok, false)
  assert.equal(state.writes.length, count)
  assert.equal(c.nivel.restauracaoPendente, true)
})

for (const [alm, aviso, esperado] of [[false, false, false], [true, false, true], [false, true, true], [true, true, true]]) {
  test(`confirma OR Alm=${alm} Aviso=${aviso} e exige MES e entrada`, async () => {
    const { c, state, controls } = fixture()
    c.alarme = resolverAlarme(rota, [record], configuracaoNivel({ nivelAlto: { habilitado: true } }))
    assert.equal(c.alarme.alternativas[0].address, 'DB3031,X1.1')
    await controls.acionarNivelAltoS7()
    state.alm = alm; state.aviso = aviso
    const result = await controls.consultarNivelAltoS7()
    assert.equal(result.ok, esperado)
    assert.equal(result.confirmadoClp, esperado)
    assert.equal(result.tags.length, 3)
    if (esperado) {
      await assert.rejects(controls.confirmarNivelAltoMesS7({ statusMes: 'Iniciado' }))
      assert.equal((await controls.confirmarNivelAltoMesS7({ statusMes: 'Nível Alto' })).ok, true)
    }
    assert.equal((await controls.restaurarNivelAltoS7()).ok, true)
  })
}
test('bloqueia partida se Aviso já ativo e rejeita confirmação com leitura inválida', async () => {
  const { c, state, controls } = fixture()
  c.alarme = resolverAlarme(rota, [record], configuracaoNivel({ nivelAlto: { habilitado: true } }))
  state.aviso = true
  await assert.rejects(controls.acionarNivelAltoS7(), /mudou/)
  assert.equal(state.writes.length, 0)
  state.aviso = false
  await controls.acionarNivelAltoS7()
  state.alm = true; state.avisoGood = false
  assert.equal((await controls.consultarNivelAltoS7()).ok, false)
})

test('LSH_TQME19 sem offset usa DB importado e os bits autorizados, sem cadastro individual', () => {
  const cfg = configuracaoNivel({ nivelAlto: { habilitado: true } })
  const rotaTq = { nivelAlto: { aplicavel: true, status: 'NT', io: 'LSH_TQME19', idDigital: 99 } }
  const tag = { ...record, block: 'DIG099_LSH_TQME19', dbNumber: 4812, offsetBits: undefined, unverifiedLayout: true, suggestedOffsetBits: 511 }
  const result = resolverAlarme(rotaTq, [tag], cfg)
  assert.equal(result.address, 'DB4812,X1.0')
  assert.equal(result.alternativas[0].address, 'DB4812,X1.1')
  assert.throws(() => resolverAlarme(rotaTq, [], cfg), /não localizado/)
  assert.throws(() => resolverAlarme(rotaTq, [tag, { ...tag, dbNumber: 4813 }], cfg), /única/)
  assert.throws(() => resolverAlarme(rotaTq, [{ ...tag, block: 'DIG098_LSH_TQME19' }], cfg), /não localizado/)
})

function fixtureRearme({ habilitado = true, entrada = false, alarme = true, perderResposta = false } = {}) {
  const contato = configurarContatoLSH(1)
  const c = { codigo: '169', baseline: 10, connection: 'plcsim:0',
    lsh: { id: 'lsh', address: 'I31.2', writable: true }, alarme: { id: 'alm', address: 'DB3023,X1.0' } }
  const eventos = []
  let sequencia = 10
  const cfg = configuracaoNivel({ nivelAlto: { habilitado: true, rearmarRecusaPlcsim: habilitado } })
  const controle = criarControleNivel({
    getContext: () => c, cfg, contato, pollMs: 100,
    exigirLivre: () => eventos.push('livre'),
    registrarEscrita: (fase, operacao) => {
      assert.equal(operacao.tipoEscrita, 'rearme-plcsim')
      assert.equal(operacao.lsh.valorInicial, false)
      assert.equal(operacao.nivel.valorSolicitado, true)
      eventos.push(fase)
    },
    chamar: async (rota, opcoes) => {
      if (rota === '/api/escrita') {
        eventos.push('escrita')
        assert.deepEqual(JSON.parse(opcoes.body), { id: 'lsh', connection: c.connection, expected: false, value: true })
        entrada = true
        alarme = false
        if (perderResposta) throw new Error('resposta perdida')
        return { acknowledged: true, verified: true, observed: true, sequence: ++sequencia }
      }
      return { mode: 's7', state: 'ok', connected: true, connection: c.connection,
        sequence: ++sequencia, receivedAt: new Date().toISOString(),
        tags: [{ ...c.lsh, good: true, value: entrada }, { ...c.alarme, good: true, value: alarme }] }
    },
  })
  return { rearme: () => controle.rearmarRecusaNivelAltoS7({ codigo: c.codigo }), eventos }
}

test('PLCSIM rearma uma única vez com persistência antes da escrita e releitura de LSH e Alm', async () => {
  const { rearme, eventos } = fixtureRearme()
  assert.deepEqual(await rearme(), { address: 'I31.2', anterior: false, valorNormal: true, escrita: true, amostra: 13 })
  await assert.rejects(rearme(), /já tentado/)
  assert.deepEqual(eventos, ['livre', 'solicitada', 'escrita', 'confirmada', 'restaurada'])
})

test('rearme PLCSIM preserva a pendência após perder resposta, sem reenviar', async () => {
  const { rearme, eventos } = fixtureRearme({ perderResposta: true })
  await assert.rejects(rearme(), /resposta perdida/)
  await assert.rejects(rearme(), /já tentado/)
  assert.deepEqual(eventos, ['livre', 'solicitada', 'escrita'])
})

test('LSH normal com alarme ativo impede escrita e nova tentativa', async () => {
  const { rearme, eventos } = fixtureRearme({ entrada: true })
  await assert.rejects(rearme(), /Alm\/Aviso continuam ativos/)
  assert.deepEqual(eventos, ['livre'])
})

test('LSH e alarme já normais permitem tentativa sem escrita', async () => {
  const { rearme, eventos } = fixtureRearme({ entrada: true, alarme: false })
  assert.equal((await rearme()).escrita, false)
  assert.deepEqual(eventos, ['livre'])
})

test('rearme exige configuração explícita do PLCSIM', async () => {
  const { rearme, eventos } = fixtureRearme({ habilitado: false })
  await assert.rejects(rearme(), /indisponível/)
  assert.deepEqual(eventos, [])
})
