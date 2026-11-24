const dados = Cypress.expose('catalogoRev00')
if (!dados || dados.erro) {
  describe('Rev 00 indisponível', () => {
    it('Informa o problema de configuração', () => {
      throw new Error(dados?.erro || 'Dados da revisão não carregados')
    })
  })
} else if (dados.mensagemSemPendencias) {
  describe('Transferências', () => {
    it(dados.mensagemSemPendencias, () => {
      cy.log(dados.mensagemSemPendencias)
    })
  })
} else {
  Cypress.expose('execucao', dados.execucao)
  Cypress.expose('monitorS7', dados.monitorS7)
  Cypress.expose('nivelAltoHabilitado', dados.nivelAltoHabilitado === true)
  Cypress.expose('rearmarRecusaPlcsim', dados.rearmarRecusaPlcsim === true)
  Cypress.expose('pilotoS7', dados.pilotoS7 === true)
  Cypress.expose('rotas', dados.rotas)
  Cypress.expose('retomarPasta', dados.retomarPasta || null)
  require('./rotas-transferencias.js')
}
