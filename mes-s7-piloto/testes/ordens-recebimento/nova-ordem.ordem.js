// Spec preparado com Cypress Author em 24/11/2026.
require('../../comum/consultas-mes')
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

function normalizarRotulo(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f\u200b-\u200f\ufeff]/g, '').trim().toLowerCase()
}

Cypress.Commands.addQuery('campoDaOrdem', function (rotulo) {
  this.set('timeout', timeout)
  return () => {
    const doc = cy.state('document')
    const visivel = Cypress.dom.isVisible
    const corresponde = el => rotulo.test(normalizarRotulo(el.textContent))
    const seletor = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'
    const rotulos = [...doc.querySelectorAll('label, span, div, p')].filter(el =>
      corresponde(el) && visivel(el) && ![...el.children].some(filho => corresponde(filho) && visivel(filho)))
    const campos = new Set()
    for (const texto of rotulos) {
      if (texto.control?.matches(seletor) && visivel(texto.control)) {
        campos.add(texto.control)
        continue
      }
      for (let grupo = texto; grupo && grupo !== doc.body; grupo = grupo.parentElement) {
        const entradas = [...grupo.querySelectorAll(seletor)].filter(visivel)
        if (entradas.length === 1) campos.add(entradas[0])
        if (entradas.length) break
      }
    }
    return Cypress.$([...campos])
  }
})

function dadosDaOrdem() {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const letra = () => letras[Math.floor(Math.random() * letras.length)]
  const digito = () => Math.floor(Math.random() * 10)
  const placa = letra() + letra() + letra() + digito() + letra() + digito() + digito()
  const lote = 'P' + Array.from(globalThis.crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  return { lote, placa }
}

it('Libera uma nova ordem de recebimento para cadastrar o produto', { viewportWidth: 1440, viewportHeight: 850 }, () => {
  acessarMes()
  cy.contains('.text-navbar', /^Movimentação$/, { timeout }).should('be.visible').click()
  cy.contains(/^Ordem(?: de)? Recebimento$/, { timeout }).should('be.visible').click()
  cy.adicionarOrdem().should('have.length', 1).and('be.visible').click()
  cy.contains(/^Itens da Ordem de Recebimento$/, { timeout }).should('be.visible')
  const { lote, placa } = dadosDaOrdem()
  cy.campoDaOrdem(/^codigo(?:\s|[|¦:\/Il-])*lote:?$/i).should('have.length', 1).and('be.enabled').clear().type(lote).should('have.value', lote)
  cy.campoDaOrdem(/^placa:?$/).should('have.length', 1).and('be.enabled').clear().type(placa).should($campo => {
    expect($campo.val().replace(/[\s-]/g, '').toUpperCase()).to.equal(placa)
  })
  cy.elementoMes('button', 'Liberar').should('have.length', 1).and('be.enabled').click()
  cy.adicionarOrdem().should($controle => {
    expect($controle, 'Adicionar item após liberar a ordem').to.have.length(1)
    expect($controle.closest(':disabled, [disabled], [aria-disabled="true"], .disabled')).to.have.length(0)
  })
  cy.screenshot('nova-ordem-liberada', { capture: 'viewport', overwrite: false })
})
