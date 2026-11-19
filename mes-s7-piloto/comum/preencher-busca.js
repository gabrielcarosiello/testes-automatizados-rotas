'use strict'
function preencherBusca({ cy, seletor, valor, modo = 'estavel' }) {
  const campo = () => cy.get(seletor, { timeout: 30000 }).should('have.length', 1).should('be.visible').and('be.enabled')
  const texto = String(valor)
  if (!['estavel', 'rapida'].includes(modo)) throw new Error('Modo de digitação inválido.')
  // O MES pode desabilitar/recriar a entrada a cada atualização assíncrona.
  // Nunca continuar uma cadeia com a referência anterior à alteração do campo.
  function digitar(indice) {
    if (indice >= texto.length) return campo().should('have.value', texto)
    return campo().should('have.value', texto.slice(0, indice))
      .type(texto[indice], { parseSpecialCharSequences: false, delay: 0 })
      .then(() => digitar(indice + 1))
  }
  return campo().clear().then(() => modo === 'rapida'
    ? campo().type(texto, { parseSpecialCharSequences: false }).then(() => campo().should('have.value', texto))
    : digitar(0))
}
module.exports = { preencherBusca }
