const { controleAdicionarOrdem } = require('./controle-adicionar')

Cypress.Commands.addQuery('adicionarOrdem', function () {
  this.set('timeout', 30000)
  return () => Cypress.$(controleAdicionarOrdem(cy.state('document'), Cypress.dom.isVisible))
})

const timeout = 30000

function acessarMes() {
  const { urlMes, usuarioMes, erroSenhaMes, erro } = Cypress.expose('criacaoOrdem') || Cypress.expose('recebimento') || {}
  if (erro) throw new Error(erro)
  if (!urlMes) throw new Error('Configuração de acesso ao MES indisponível para Ordem Recebimento.')
  cy.visit(urlMes)
  cy.location('pathname', { timeout }).should('match', /\/(login|home)\/?$/i).then(caminho => {
    if (/\/home\/?$/i.test(caminho)) return
    cy.get('.form-select', { timeout }).should('be.visible').click()
    cy.get('[title=' + JSON.stringify(usuarioMes) + ']', { timeout })
      .should('have.length', 1).should('be.visible').click()
    cy.env(['senhaMES'], { log: false }).then(({ senhaMES }) => {
      if (typeof senhaMES !== 'string' || !senhaMES.trim()) {
        throw new Error(erroSenhaMes || 'Senha MES ausente. Confira credenciais.local.json.')
      }
      cy.get('[name="loginModel.Password"]', { timeout }).should('be.visible')
        .type(senhaMES, { log: false, parseSpecialCharSequences: false })
    })
    cy.get('.btn:visible', { timeout }).should('have.length', 1).click()
  })
  return cy.location('pathname', { timeout }).should('match', /\/home\/?$/i)
}

function abrirListaDeOrdens() {
  cy.contains('.text-navbar', /^Movimentação$/, { timeout }).should('be.visible').click()
  return cy.contains(/^Ordem(?: de)? Recebimento$/, { timeout }).should('be.visible').click()
}

module.exports = { acessarMes, abrirListaDeOrdens }
