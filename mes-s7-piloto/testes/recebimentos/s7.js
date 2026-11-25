const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { gravarEvento } = require('../../comum/registro-execucao')
const { criarEstadoEscrita } = require('../../comum/s7/estado-escrita')
const { criarPiloto } = require('../../comum/s7/piloto')
const { lerOrdensConfirmadas } = require('./ordens-confirmadas')
const { lerRotaRecebimento } = require('./lir-recebimento')

function registrarConfirmacao(raiz, pasta, aposIniciar, dados, entrega) {
  fs.mkdirSync(path.join(raiz, 'resultados', pasta), { recursive: true })
  gravarEvento(raiz, pasta, aposIniciar ? 'recebimento-confirmado' : 'recebimento-ja-confirmado', { ...dados, entrega })
  return { pasta, evidencia: 'resultados/' + pasta + '/eventos.jsonl', entrega }
}

function tarefasRecebimento(raiz, planilha) {
  let piloto
  let pasta
  return {
    exigirRestauracaoLivreRecebimento() {
      criarEstadoEscrita(raiz).exigirLivre()
      return null
    },
    async verificarRecebimentoEnsacados({ numero, codigoProduto, aposIniciar = false }) {
      if (!/^\d+$/.test(numero)) throw new Error('OR inválida para consulta de Ensacados.')
      const { consultarRecebimentoEnsacados } = require('../../comum/s7/consultarRota')
      const confirmado = await consultarRecebimentoEnsacados({ numero, codigoProduto })
      if (!confirmado) return null
      const pasta = 'Recebimento_Ensacados_' + numero + '_' + randomUUID()
      return registrarConfirmacao(raiz, pasta, aposIniciar, { numero, codigoProduto, ...confirmado }, {
        origem: aposIniciar ? 'nesta-execucao' : 'ja-recebido',
        modalidade: 'Ensacados', ordem: String(numero), codigoProduto, item: confirmado.item,
        destino: { tipo: 'armazem', codigo: confirmado.armazem },
        quantidadeRecebida: confirmado.quantidadeRecebida, pesoRecebidoKg: confirmado.pesoRecebido,
        confirmadoEm: confirmado.recebidoEm,
      })
    },
    planejarRecebimentoEnsacados(id) {
      const produto = require('../ordens-recebimento/cenarios-ensacados.json').find(item => item.id === id)
      if (!produto) throw new Error('Cenário de Ensacados desconhecido: ' + id)
      const ordem = lerOrdensConfirmadas(path.join(raiz, 'resultados')).find(registro =>
        registro.item.ensacados === true && registro.item.id === id && registro.item.codigoProduto === produto.codigoProduto)
      if (!ordem) throw new Error('Nenhuma OR de Ensacados confirmada para o cenário ' + id + '.')
      return { numero: ordem.numero, produto: ordem.item }
    },
    planejarPrePartidaRecebimento(id) {
      const cenario = require('./cenarios-prepartida.json').find(item => item.id === id)
      if (!cenario) throw new Error('Cenário de pré-partida desconhecido: ' + id)
      const produto = require('../ordens-recebimento/cenarios.json').find(item => item.id === id)
      if (!produto) throw new Error('Produto não configurado no cenário: ' + id)
      const ordem = lerOrdensConfirmadas(path.join(raiz, 'resultados')).find(registro =>
        registro.item.id === id && registro.item.codigoProduto === produto.codigoProduto)
      if (!ordem) throw new Error('Nenhuma OR confirmada no cadastro para o cenário ' + id + '.')
      const rota = lerRotaRecebimento(raiz, planilha ? path.resolve(raiz, planilha) : undefined, cenario.codigoRota)
      return { modalidade: cenario.modalidade, aba: cenario.aba ?? cenario.modalidade, ordem: ordem.numero, produto: ordem.item, rota }
    },
    async verificarRecebimentoNoSilo({ ordem, codigoRota, destino, codigoProduto, modalidade = "Granel", aposIniciar = false }) {
      if (!/^\d+$/.test(ordem) || !/^\d+$/.test(codigoRota)) throw new Error('Ordem e rota inválidas para consulta do recebimento.')
      const { consultarRecebimentoNoSilo } = require('../../comum/s7/consultarRota')
      const confirmado = await consultarRecebimentoNoSilo({ ordem, codigoRota, destino, codigoProduto })
      if (!confirmado) return null
      const pastaConfirmacao = 'Recebimento_' + ordem + '_confirmado_' + randomUUID()
      const registro = registrarConfirmacao(raiz, pastaConfirmacao, aposIniciar, { ordem, codigoRota, destino, codigoProduto, ...confirmado }, {
        origem: aposIniciar ? 'nesta-execucao' : 'ja-recebido',
        modalidade, ordem: String(ordem), codigoProduto, item: confirmado.item,
        codigoRota: String(codigoRota), destino: { tipo: 'silo', codigo: destino },
        pesoRecebidoKg: confirmado.pesoRecebido, saldoSiloKg: confirmado.saldoSilo,
        confirmadoEm: confirmado.finalizadoEm,
      })
      return { ...confirmado, ...registro }
    },
    async prepararRecebimentoS7({ ordem, codigo } = {}) {
      if (!/^\d+$/.test(ordem) || !/^\d+$/.test(codigo)) throw new Error('Informe a ordem e o código de rota selecionados na pré-partida.')
      const local = JSON.parse(fs.readFileSync(path.join(raiz, 's7.local.json'), 'utf8').replace(/^\uFEFF/, ''))
      if (typeof local.habilitado !== 'boolean') throw new Error('Defina habilitado em s7.local.json, como no Transporte.')
      if (!local.habilitado) return { equipamentos: false, nivelAlto: false }
      const rota = lerRotaRecebimento(raiz, planilha ? path.resolve(raiz, planilha) : undefined, codigo)
      const somentePartida = local.recebimento?.nivelAltoHabilitado === false
      const rotas = [somentePartida ? { ...rota, nivelAlto: { ...rota.nivelAlto, aplicavel: false } } : rota]
      const candidato = criarPiloto(raiz, undefined, { rotas, prevalidarSql: true,
        consultarSilo: destino => require('../../comum/s7/consultarRota').consultarSilo(destino) })
      const catalogo = await candidato.validarCatalogoS7()
      const pastaExecucao = 'Recebimento_' + ordem + '_' + randomUUID()
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
