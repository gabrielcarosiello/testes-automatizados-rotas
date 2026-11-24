
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

const fonte = fs.readFileSync(path.join(__dirname, 's7.js'), 'utf8')

function carregar(rotas, chamadas, habilitado = true, recebimento, capturarRota = () => {}) {
  const modulo = { exports: {} }
  const piloto = {
    async validarCatalogoS7() { return { nivelAlto: { habilitado: true } } },
    async prepararS7({ codigo, rearmar }) { chamadas.push(['preparar', codigo, rearmar]) },
    async confirmarS7(dados) { chamadas.push(['equipamentos', dados.inicio]) },
    async acionarNivelAltoS7() { chamadas.push(['lsh']) },
    async restaurarNivelAltoS7() { chamadas.push(['restaurar']); return { ok: true } },
    salvarEvidenciaS7() { chamadas.push(['evidencia']); return 'evidencia.json' },
  }
  vm.runInNewContext(fonte, {
    module: modulo,
    require(id) {
      if (id === 'node:fs') return { readFileSync: () => JSON.stringify({ habilitado, recebimento }), mkdirSync() {} }
      if (id === './lir-recebimento') return { lerRotaRecebimento: () => rotas[0] }
      if (id === '../../comum/s7/piloto') return { criarPiloto: (_, __, opcoes) => { capturarRota(opcoes.rotas[0]); chamadas.push(['criar']); return piloto } }
      return require(id)
    },
  })
  return modulo.exports.tarefasRecebimento(__dirname)
}

const rota = { codigo: 123, destino: 'MG01', rota: 'RG01 -> RG03 -> RG04 -> RG22 -> MG01', nivelAlto: { aplicavel: true } }

test('Recebimento prepara sem rearme e usa o mesmo contexto para restaurar e registrar a evidência', async () => {
  const chamadas = []
  const tarefas = carregar([rota], chamadas)
  const preparo = await tarefas.prepararRecebimentoS7({ ordem: '9407', codigo: 123 })
  assert.equal(preparo.nivelAlto, true)
  assert.equal(preparo.codigo, rota.codigo)
  assert.match(preparo.pasta, /^Recebimento_9407_/)
  await tarefas.confirmarEquipamentosRecebimentoS7({ inicio: 100 })
  await tarefas.acionarNivelAltoRecebimentoS7()
  assert.equal((await tarefas.restaurarNivelAltoRecebimentoS7()).ok, true)
  const resultado = await tarefas.concluirEvidenciaRecebimentoS7()
  assert.equal(resultado.evidencia, 'evidencia.json')
  assert.deepEqual(chamadas, [['criar'], ['preparar', 123, false], ['equipamentos', 100], ['lsh'], ['restaurar'], ['restaurar'], ['evidencia']])
})

test('Recebimento usa o modo MES configurado e dispensa LSH quando ela não se aplica', async () => {
  const chamadas = []
  const mes = await carregar([], chamadas, false).prepararRecebimentoS7({ ordem: '9407', codigo: 123 })
  assert.equal(mes.equipamentos, false)
  assert.deepEqual(chamadas, [])
  const s7 = await carregar([{ ...rota, nivelAlto: { aplicavel: false } }], chamadas).prepararRecebimentoS7({ ordem: '9407', codigo: 123 })
  assert.equal(s7.equipamentos, true)
  assert.equal(s7.nivelAlto, false)
})

test('Recebimento confirma equipamentos sem LSH quando a configuração da partida desabilita o ensaio', async () => {
  let rotaPreparada
  const tarefas = carregar([rota], [], true, { nivelAltoHabilitado: false }, valor => { rotaPreparada = valor })
  const resultado = await tarefas.prepararRecebimentoS7({ ordem: '9407', codigo: 123 })
  assert.equal(resultado.equipamentos, true)
  assert.equal(resultado.nivelAlto, false)
  assert.equal(rotaPreparada.nivelAlto.aplicavel, false)
  assert.equal(rota.nivelAlto.aplicavel, true)
})
