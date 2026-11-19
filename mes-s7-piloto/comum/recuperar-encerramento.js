'use strict'
const { estadoRecuperacao } = require('./cartoes-mes')
function recuperarEncerramento({ cy, execucao, atual, visivel, prazoMs = 10000, agora = Date.now }) {
  const limite = agora() + prazoMs
  function conferir() {
    return cy.document({ log: false }).then(documento => {
      const estado = estadoRecuperacao(documento, visivel, atual.rota.nome)
      if (!estado.livre && agora() < limite) return cy.wait(500, { log: false }).then(conferir)
      if (estado.livre && !execucao.restauracaoFalhou) execucao.anterior = null
      return cy.task('registrarEtapa', { pasta: execucao.pasta, codigo: atual.rota.codigo, etapa: estado.detalhe }, { log: false })
        .then(() => cy.log(estado.detalhe)).then(() => estado)
    })
  }
  return conferir()
}
module.exports = { recuperarEncerramento }
