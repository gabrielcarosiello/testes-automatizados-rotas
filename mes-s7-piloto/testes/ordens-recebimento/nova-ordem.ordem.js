// Spec preparado com Cypress Author em 24/11/2026.
const { carregarCenarios } = require('./cenarios')
const { criarOrdem } = require('./fluxo-cadastro')
const cenarios = carregarCenarios(require('./cenarios.json'))

for (const cenario of cenarios) {
  it('Cria e confere a ordem de ' + cenario.nomeProduto + ' (' + cenario.id + ')',
    { viewportWidth: 1440, viewportHeight: 850 }, () => criarOrdem(cenario))
}
