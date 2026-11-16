const dados = Cypress.expose('catalogoRev00')
if (!dados || dados.erro) {
  describe('Rev 00 indisponível', () => {
    it('Informa o problema de configuração', () => {
      throw new Error(dados?.erro || 'Dados da revisão não carregados')
    })
  })
} else {
  Cypress.expose('rotas', dados.rotas)
  Cypress.expose('retomarPasta', dados.retomarPasta || null)
  require('./rotas-transferencias.js')
}
