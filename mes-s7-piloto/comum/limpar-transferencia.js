'use strict'
const { confirmarVazio } = require('./cartoes-mes')

function aguardarEncerramento({ cy, acao, visivel, prazoMs = 10000, agora = Date.now }) {
  let limite = agora() + prazoMs
  let confirmou = false

  function conferir() {
    return cy.document({ log: false }).then(doc => {
      if (confirmarVazio(doc, visivel)) return { confirmou }
      if (!confirmou) {
        const dialogs = [...doc.querySelectorAll('dialog[open], [role=dialog], [aria-modal=true], .modal.show')]
          .filter(el => visivel(el) && el.textContent.replace(/\s+/g, ' ').includes('Deseja realmente ' + acao + ' a transferência'))
        const internos = dialogs.filter(el => !dialogs.some(outro => el !== outro && el.contains(outro)))
        if (internos.length > 1) throw new Error('Mais de uma confirmação de ' + acao + ' encontrada.')
        if (internos.length === 1) {
          const botoes = [...internos[0].querySelectorAll('button')].filter(el =>
            visivel(el) && el.textContent.trim() === 'Sim' && !el.matches(':disabled, [aria-disabled="true"]'))
          if (botoes.length > 1) throw new Error('Botão Sim ambíguo ao ' + acao + ' a transferência.')
          if (botoes.length === 1) {
            confirmou = true
            return cy.wrap(botoes[0], { log: false }).click({ timeout: 5000 }).then(() => {
              limite = agora() + prazoMs
              return conferir()
            })
          }
        }
      }
      if (agora() >= limite) {
        throw new Error('Encerramento não confirmado ao ' + acao + ' a transferência. O MES continua sem indicação de local vazio.')
      }
      return cy.wait(250, { log: false }).then(conferir)
    })
  }
  return conferir()
}

function limparTransferencia({ cy, nome, botao, visivel, prazoMs, agora }) {
  const limpar = botao ? cy.wrap(botao, { log: false }) : cy.elementoMes('button', 'Limpar', { cartao: nome })
  return limpar.click({ timeout: 5000 })
    .then(() => aguardarEncerramento({ cy, acao: 'limpar', visivel, prazoMs, agora }))
}
module.exports = { aguardarEncerramento, limparTransferencia }
