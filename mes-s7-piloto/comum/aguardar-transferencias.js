'use strict'
const { diagnosticarLocal } = require('./cartoes-mes')
function aguardarEstadoTransferencias({ cy, visivel, prazoMs = 30000, agora = Date.now }) {
  const limite = agora() + prazoMs
  let anterior = null
  function consultar() {
    return cy.document({ log: false }).then(documento => {
      const estado = diagnosticarLocal(documento, visivel)
      const pronto = estado.cartoes.every(c => c.botoes.length === 0 ? c.limpar.length > 0 : c.situacoes > 0)
      const assinatura = estado.vazio ? 'vazio' : estado.cartoes.length && pronto ? JSON.stringify(estado.cartoes.map(c => [c.nome, c.botoes.length, c.limpar.length, c.situacoes, c.ambiguo])) : null
      // A aba pode renderizar entre o clique e a primeira leitura: exigir estado estável.
      if (assinatura && anterior === assinatura) return estado
      anterior = assinatura
      if (agora() >= limite) throw new Error(`Estado das transferências não estabilizou: mensagem vazia=${estado.mensagem}, cartões=${estado.cartoes.length}, situações=${estado.estados}, Parar=${estado.parar}, diálogos=${estado.dialogos}, confirmação=${estado.confirmacao}.`)
      return cy.wait(200, { log: false }).then(consultar)
    })
  }
  return consultar()
}
module.exports = { aguardarEstadoTransferencias }
