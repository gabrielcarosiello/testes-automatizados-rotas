const { lerCartoes } = require('./cartoes-mes')
// Piloto 03: consulta o documento atual a cada tentativa do Cypress.
Cypress.Commands.addQuery('elementoMes', function (seletor, texto, opcoes = {}) {
  this.set('timeout', 30000)
  const normalizar = valor => {
    const limpo = String(valor || '').replace(/\s+/g, ' ').trim()
    return opcoes.ignorarAcentos
      ? limpo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      : limpo
  }
  return () => {
    const documento = cy.state('document')
    let raiz = Cypress.$(documento)
    if (opcoes.cartao) {
      const cartoes = lerCartoes(documento, Cypress.dom.isVisible, opcoes.cartao)
      if (cartoes.length > 1 || cartoes.some(c => c.ambiguo)) throw new Error(`Mais de um cartão real da transferência: ${opcoes.cartao}`)
      // Zero cartões é transitório: devolver coleção vazia permite a consulta repetir.
      if (!cartoes.length) return Cypress.$([])
      raiz = Cypress.$(cartoes[0].linha)
    }
    let candidatos = raiz.find(seletor)
    if (opcoes.includeShadowDom) {
      const raizes = opcoes.cartao ? [raiz[0]] : [documento]
      for (const atual of raizes) {
        for (const elemento of atual.querySelectorAll('*')) {
          if (elemento.shadowRoot) {
            raizes.push(elemento.shadowRoot)
            candidatos = candidatos.add(Cypress.$(elemento.shadowRoot).find(seletor))
          }
        }
      }
    }
    const elementos = candidatos.filter((_, elemento) =>
      Cypress.dom.isVisible(elemento) && normalizar(elemento.textContent) === normalizar(texto)
    )
    if (elementos.length > 1) throw new Error(`Mais de um elemento visível para "${texto}".`)
    return elementos
  }
})
