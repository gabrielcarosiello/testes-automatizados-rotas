// Spec preparado com Cypress Author em 24/11/2026.
const { carregarCenarios } = require('./cenarios')
const { criarOrdem } = require('./fluxo-cadastro')
const cenarios = carregarCenarios(require('./cenarios-ensacados.json'), { ensacados: true })

for (const cenario of cenarios) {
  it('Cria e confere a ordem de Ensacados de ' + cenario.nomeProduto + ' (' + cenario.id + ')',
    () => {
      cy.viewport(1680, 900)
      return criarOrdem(cenario, { ensacados: true })
    })
}
