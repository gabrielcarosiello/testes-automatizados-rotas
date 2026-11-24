'use strict'
const { diagnosticarLocal, estadoRecuperacao } = require('./cartoes-mes')

function recuperarEncerramento({ cy, execucao, atual, visivel, solicitarParada, prazoMs = 10000, agora = Date.now }) {
  let limite = agora() + prazoMs
  let paradaDeRecuperacao = false

  function conferir() {
    return cy.document({ log: false }).then(documento => {
      const estado = estadoRecuperacao(documento, visivel, atual.rota.nome)
      if (!estado.livre && !atual.tentouParar && atual.cartaoIniciado &&
          execucao.anterior && !execucao.restauracaoFalhou && solicitarParada) {
        const { cartoes, parar, dialogos, confirmacao } = diagnosticarLocal(documento, visivel)
        const [cartao] = cartoes
        // O nome pode se repetir entre rotas. Exija a mesma linha observada em Iniciado.
        if (cartoes.length === 1 && !cartao.ambiguo && cartao.linha === atual.cartaoIniciado &&
            cartao.nome === atual.rota.nome && cartao.situacoes === 1 &&
            cartao.textosSituacoes[0] === 'Iniciado' && !dialogos && !confirmacao &&
            parar === 1 && cartao.botoes.length === 1 &&
            !cartao.botoes[0].matches(':disabled, [aria-disabled="true"]')) {
          atual.tentouParar = true
          paradaDeRecuperacao = true
          return solicitarParada(cartao).then(() => {
            limite = agora() + prazoMs
            return conferir()
          })
        }
      }
      if (!estado.livre && agora() < limite) return cy.wait(500, { log: false }).then(conferir)
      if (estado.livre && !execucao.restauracaoFalhou) execucao.anterior = null
      if (estado.livre && paradaDeRecuperacao) estado.detalhe = 'Parada de recuperação confirmada no MES após a falha.'
      if (!estado.livre && !atual.tentouParar) {
        estado.detalhe = 'Encerramento não confirmado no MES. Condições para iniciar uma parada de recuperação não atendidas.'
      }
      return cy.task('registrarEtapa', { pasta: execucao.pasta, codigo: atual.rota.codigo, etapa: estado.detalhe }, { log: false })
        .then(() => cy.log(estado.detalhe)).then(() => estado)
    })
  }
  return conferir()
}
module.exports = { recuperarEncerramento }
