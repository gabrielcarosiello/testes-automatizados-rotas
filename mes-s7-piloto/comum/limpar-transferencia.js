'use strict'
const { confirmarVazio } = require('./cartoes-mes')
function limparTransferencia({ cy, nome, visivel }) {
  return cy.elementoMes('button', 'Limpar', { cartao: nome }).click({ timeout: 30000 })
    .then(() => cy.contains('Deseja realmente limpar a transferência', { timeout: 30000 }).should('be.visible'))
    .then(() => cy.elementoMes('button', 'Sim').click({ timeout: 30000 }))
    .then(() => cy.get('body', { timeout: 30000 }).should($body => {
      if (!confirmarVazio($body[0].ownerDocument, visivel)) throw new Error('Limpeza enviada, mas o encerramento da transferência ainda não foi confirmado no MES.')
    }))
}
module.exports = { limparTransferencia }
