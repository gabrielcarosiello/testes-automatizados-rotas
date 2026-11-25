const { acessarMes: autenticarMes } = require('../../comum/acesso-mes')
const { controleAdicionarOrdem } = require('./controle-adicionar')

Cypress.Commands.addQuery('adicionarOrdem', function () {
  this.set('timeout', 30000)
  return () => Cypress.$(controleAdicionarOrdem(cy.state('document'), Cypress.dom.isVisible))
})

const timeout = 30000

function acessarMes() {
  const acesso = Cypress.expose('criacaoOrdem') || Cypress.expose('recebimento')
  return autenticarMes(acesso, { contexto: 'Ordem Recebimento' })
}

function abrirListaDeOrdens() {
  cy.contains('.text-navbar', /^Movimentação$/, { timeout }).should('be.visible').click()
  return cy.contains(/^Ordem(?: de)? Recebimento$/, { timeout }).should('be.visible').click()
}

module.exports = { acessarMes, abrirListaDeOrdens }
