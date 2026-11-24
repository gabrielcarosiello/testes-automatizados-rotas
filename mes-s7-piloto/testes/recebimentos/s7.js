const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { criarPiloto } = require('../../comum/s7/piloto')
const { lerRotaRecebimento } = require('./lir-recebimento')

function tarefasRecebimento(raiz, planilha) {
  let piloto
  let pasta
  return {
    async prepararRecebimentoS7() {
      const local = JSON.parse(fs.readFileSync(path.join(raiz, 's7.local.json'), 'utf8').replace(/^\uFEFF/, ''))
      if (typeof local.habilitado !== 'boolean') throw new Error('Defina habilitado em s7.local.json, como no Transporte.')
      if (!local.habilitado) return { equipamentos: false, nivelAlto: false }
      const rota = lerRotaRecebimento(raiz, planilha ? path.resolve(raiz, planilha) : undefined)
      const somentePartida = local.recebimento?.nivelAltoHabilitado === false
      const rotas = [somentePartida ? { ...rota, nivelAlto: { ...rota.nivelAlto, aplicavel: false } } : rota]
      const candidato = criarPiloto(raiz, undefined, { rotas, prevalidarSql: true,
        consultarSilo: destino => require('../../comum/s7/consultarRota').consultarSilo(destino) })
      const catalogo = await candidato.validarCatalogoS7()
      const pastaExecucao = 'Recebimento_9390_' + randomUUID()
      fs.mkdirSync(path.join(raiz, 'resultados', pastaExecucao), { recursive: true })
      await candidato.prepararS7({ codigo: Number(rota.codigo), pasta: pastaExecucao, rearmar: false })
      piloto = candidato
      pasta = pastaExecucao
      return { equipamentos: true, codigo: rota.codigo, pasta, nivelAlto: catalogo.nivelAlto.habilitado && Boolean(rotas[0].nivelAlto?.aplicavel) }
    },
    confirmarEquipamentosRecebimentoS7: dados => piloto.confirmarS7(dados),
    acionarNivelAltoRecebimentoS7: () => piloto.acionarNivelAltoS7(),
    consultarNivelAltoRecebimentoS7: () => piloto.consultarNivelAltoS7(),
    confirmarNivelAltoRecebimentoS7: dados => piloto.confirmarNivelAltoMesS7(dados),
    restaurarNivelAltoRecebimentoS7: () => piloto.restaurarNivelAltoS7(),
    async concluirEvidenciaRecebimentoS7() {
      const restauracao = await piloto.restaurarNivelAltoS7()
      return { ...restauracao, evidencia: piloto.salvarEvidenciaS7({ pasta }) }
    },
  }
}

module.exports = { tarefasRecebimento }
