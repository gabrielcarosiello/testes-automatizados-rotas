// Piloto 04: visita o painel S7 no início e retorna ao MES antes do login.
function abrirMonitorERetornar(monitor, mes) {
  const origem = new URL(monitor).origin
  cy.log('Abrir Monitor S7 e conferir API')
  cy.origin(origem, () => {
    cy.visit('/')
    cy.get('#tag-cards', { timeout: 30000 }).should('exist')
    cy.title().should('include', 'Monitor')
  })
  cy.request({
    url: origem + '/api/tags',
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    timeout: 10000,
  }).then(({ status, body }) => {
    expect(status, 'resposta da API do Monitor').to.be.oneOf([200, 503])
    expect(body.tags, 'lista de tags do Monitor').to.be.an('array')
    expect(body.mode, 'modo informado pelo Monitor').to.be.oneOf(['demo', 's7'])
    cy.log(`API S7 disponível — modo ${body.mode}, estado ${body.state}`)
  })
  cy.log('Retornar ao MES para iniciar o login')
  return cy.visit(mes)
}

module.exports = { abrirMonitorERetornar }
