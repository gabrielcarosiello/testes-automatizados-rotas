const { test } = require('node:test')
const assert = require('node:assert/strict')
const { selecionarValidacao } = require('./perfis')
const { mapear, diagnostico } = require('./piloto')
const padrao = require('../../perfis-s7.json')
const equipamento = {
  cod_equipamento: 167, tip_equipamento: 3, des_tag: 'RG25', val_comando: 1,
  espelhos_entrada: ['DB1166,X1.5', 'DB1166,X1.6'],
}
const catalogo = [
  { block: 'EQP166_RG25', dbNumber: 1166, type: 'Bool', name: 'Eqp.EquipamentoDWord1.EspelhoEntrada1', offsetBits: 13 },
  { block: 'EQP166_RG25', dbNumber: 1166, type: 'Bool', name: 'Eqp.EquipamentoDWord1.EspelhoEntrada2', offsetBits: 14 },
  { block: 'EQP166_RG25', dbNumber: 1166, type: 'Bool', name: 'Eqp.EquipamentoDWord1.EspelhoSaida1', offsetBits: 15 },
]

test('cadastro individual RG25 tipo 3 seleciona entrada de posição, comandos 1 e 2', () => {
  assert.equal(mapear([equipamento], catalogo)[0].address, 'DB1166,X1.5')
  assert.equal(mapear([{ ...equipamento, val_comando: 2 }], catalogo)[0].address, 'DB1166,X1.6')
  assert.equal(mapear([equipamento], catalogo)[0].equipamentos[0].cod_equipamento, 167)
})

test('tipo do cadastro SQL muda o perfil sem nome de equipamento fixado', () => {
  const outro = { ...equipamento, cod_equipamento: 999, des_tag: 'OUTRO' }
  assert.equal(selecionarValidacao(outro).espelho, 'EspelhoEntrada1')
  assert.equal(mapear([{ ...outro, tip_equipamento: 2 }], catalogo)[0].address, 'DB1166,X1.7')
  assert.throws(() => selecionarValidacao({ ...outro, tip_equipamento: null }), /Tipo ausente/)
  assert.throws(() => selecionarValidacao({ ...outro, tip_equipamento: 99 }), /Configure o perfil/)
})

test('configuração por equipamento prevalece sobre o perfil por tipo', () => {
  const customizada = structuredClone(padrao)
  customizada.porEquipamento['167'] = 'saidaMantida'
  assert.equal(mapear([equipamento], catalogo, customizada)[0].address, 'DB1166,X1.7')
  customizada.perfis.posicaoConfirmada.camposPorComando['2'] = 'EspelhoEntrada1'
  assert.equal(selecionarValidacao({ ...equipamento, cod_equipamento: 168, val_comando: 2 }, customizada).espelho, 'EspelhoEntrada1')
})

test('posição já confirmada é aceita antes da partida e endereço divergente bloqueia', () => {
  const [tag] = mapear([equipamento], catalogo)
  const amostra = { connected: true, state: 'ok', mode: 's7', sequence: 1,
    receivedAt: new Date().toISOString(), tags: [{ ...tag, good: true, value: true }] }
  assert.equal(diagnostico(amostra, [tag], false), '')
  assert.equal(diagnostico(amostra, [tag], true), '')
  assert.throws(() => mapear([{ ...equipamento, espelhos_entrada: ['DB1166,X2.5', 'DB1166,X1.6'] }], catalogo), /diverge/)
})

test('modo entradas força entradas por comando mesmo com perfil de saída por equipamento', () => {
  const customizada = structuredClone(padrao)
  customizada.porEquipamento['167'] = 'saidaMantida'
  const tipoSaida = { ...equipamento, tip_equipamento: 1 }
  const [tag] = mapear([tipoSaida], catalogo, customizada, 'entradas')
  assert.equal(tag.address, 'DB1166,X1.5')
  assert.equal(tag.modoValidacao, 'entradas')
  assert.equal(tag.exigirDesligadoAntes, false)
  assert.equal(mapear([{ ...tipoSaida, val_comando: 2 }], catalogo, customizada, 'entradas')[0].address, 'DB1166,X1.6')
})

test('modo SQL preserva seleção por cadastro e modo entradas aceita tipo sem perfil', () => {
  assert.equal(mapear([{ ...equipamento, tip_equipamento: 1 }], catalogo)[0].address, 'DB1166,X1.7')
  assert.equal(selecionarValidacao({ ...equipamento, tip_equipamento: 99 }, padrao, 'entradas').espelho, 'EspelhoEntrada1')
  assert.throws(() => selecionarValidacao(equipamento, padrao, 'outro'), /modoValidacao/)
  assert.throws(() => mapear([{ ...equipamento, espelhos_entrada: ['DB1166,X2.5', 'DB1166,X1.6'] }], catalogo, padrao, 'entradas'), /diverge/)
})
