'use strict'
function preencherBusca({ cy, seletor, valor, modo = 'estavel' }) {
  const campo = () => cy.get(seletor, { timeout: 30000, log: false }).should('have.length', 1).should('be.visible').and('be.enabled')
  const texto = String(valor)
  if (!['estavel', 'rapida'].includes(modo)) throw new Error('Modo de digitação inválido.')
  // O MES pode desabilitar/recriar a entrada a cada atualização assíncrona.
  // Nunca continuar uma cadeia com a referência anterior à alteração do campo.
  function digitar(indice) {
    if (indice >= texto.length) return campo().should('have.value', texto)
    return campo().should('have.value', texto.slice(0, indice))
      .type(texto[indice], { parseSpecialCharSequences: false, delay: 0, log: false })
      .then(() => digitar(indice + 1))
  }
  const digitarEstavel = () => campo().clear().then(() => digitar(0))
  if (modo === 'estavel') return digitarEstavel()
  return campo().then($campo => {
    const entrada = $campo[0]
    const janela = entrada.ownerDocument.defaultView
    const setValor = Object.getOwnPropertyDescriptor(janela.HTMLInputElement.prototype, 'value').set
    entrada.focus()
    setValor.call(entrada, texto)
    entrada.dispatchEvent(new janela.InputEvent('input', { bubbles: true, inputType: 'insertText', data: texto }))
  }).then(() => campo().then($campo => {
    if ($campo[0].value !== texto) return digitarEstavel()
    return campo().should('have.value', texto)
  }))
}
module.exports = { preencherBusca }
