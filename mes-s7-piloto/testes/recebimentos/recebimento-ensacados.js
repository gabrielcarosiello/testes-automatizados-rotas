// Spec preparado com Cypress Author em 24/11/2026.
const { acessarMes } = require('../ordens-recebimento/acesso-ordem')

const menuEnsacados = /^\s*Receber\s+Ensacado\s+por\s+Ordem\s+de\s+Recebimento\s*$/i

require('../../comum/consultas-mes')
const { localizarComboEnsacados } = require('./combo-ensacados')
const cenarios = require('../ordens-recebimento/cenarios-ensacados.json')
const modalidade = /^\s*(?:Recebimento\s+(?:de\s+)?)?En(?:sac|cas)ados?\s*$/i
const modalidadeNaLista = /Recebimento\s+En(?:sac|cas)ados?/i
const rotuloRecebimento = /^recebimento\s*:?$/
const rotuloOrdem = /^ordem\s+(?:de\s+)?recebimento\s*:?$/
const opcoes = '.custom-dropdown-list:visible, [role="listbox"]:visible'

Cypress.Commands.addQuery('comboEnsacados', function (rotulo) {
  this.set('timeout', 30000)
  return () => Cypress.$(localizarComboEnsacados(cy.state('document'), rotulo, Cypress.dom.isVisible))
})

function valorSelecionado(el) {
  if (el.tagName === 'SELECT') return el.value ? el.selectedOptions[0]?.textContent ?? '' : ''
  if (el.tagName === 'INPUT') return el.value
  const entrada = el.querySelector('input')
  return entrada?.value || el.textContent.trim()
}

function aguardarFormularioLimpo() {
  return cy.document({ timeout: 30000, log: false }).should(doc => {
    for (const rotulo of [rotuloRecebimento, rotuloOrdem]) {
      const campos = localizarComboEnsacados(doc, rotulo, Cypress.dom.isVisible)
      expect(campos.length, 'campo sem duplicidade: ' + rotulo).to.be.at.most(1)
      if (campos.length) expect(valorSelecionado(campos[0]).trim(), 'campo limpo: ' + rotulo).to.equal('')
    }
  })
}

function selecionarEnsacados(rotulo, opcao, busca, textoNaLista = opcao) {
  const combo = () => cy.comboEnsacados(rotulo).should($combo => {
    expect($combo, 'caixa de seleção ' + rotulo).to.have.length(1)
  }).and('be.visible')
  return combo().then($combo => {
    if ($combo[0].tagName === 'SELECT') {
      const itens = [...$combo[0].options].filter(item => opcao.test(item.textContent.trim()))
      expect(itens, 'opção desejada no campo ' + rotulo).to.have.length(1)
      return cy.wrap($combo).select(itens[0].value)
    }
    cy.wrap($combo).click()
    const lista = () => cy.get(opcoes).filter((_, el) => !el.parentElement?.closest('.custom-dropdown-list, [role="listbox"]')).should('have.length', 1)
    if (busca) lista().then($lista => {
      const entrada = $lista.find('input:visible:enabled')
      if (entrada.length === 1) return cy.wrap(entrada).clear().type(busca)
    })
    return lista().contains(textoNaLista, { includeShadowDom: true }).should('be.visible').then($texto => {
      const linha = $texto[0].closest('tr, [role="row"], [role="option"], .dxbl-grid-data-row')
      const alvo = linha && Cypress.dom.isVisible(linha) ? linha : $texto[0]
      return cy.wrap(alvo).click('left')
    })
  }).then(() => combo().should($combo => {
    const el = $combo[0]
    const selecionado = valorSelecionado(el)
    expect(selecionado.trim(), 'valor selecionado em ' + rotulo).to.match(opcao)
  }))
}

afterEach(function () {
  if (this.currentTest.state === 'failed') return cy.screenshot('ensacados-falha', {
    capture: 'viewport', overwrite: false, blackout: ['input[type="password"]'],
  })
})

for (const cenario of cenarios) {
  it('Seleciona e inicia a OR de Ensacados — ' + cenario.id, { viewportWidth: 1440, viewportHeight: 850 }, () => {
    cy.task('planejarRecebimentoEnsacados', cenario.id).then(({ numero, produto }) => {
      const dados = { numero, codigoProduto: produto.codigoProduto }
      return cy.task('verificarRecebimentoEnsacados', dados, { timeout: 60000 }).then(confirmado => {
        if (confirmado) return cy.log('OR ' + numero + ' já recebida. Evidência: ' + confirmado.evidencia)
        const ordem = new RegExp('\\b' + numero + '\\b')
        cy.log('OR ' + numero + ' | ' + produto.nomeProduto)
        acessarMes()
        cy.contains('.text-navbar', /^Movimentação$/, { timeout: 30000 }).should('be.visible').click()
        cy.contains('.card-text', menuEnsacados, { timeout: 30000 }).should('be.visible').click()
        selecionarEnsacados(rotuloRecebimento, modalidade, undefined, modalidadeNaLista)
        selecionarEnsacados(rotuloOrdem, ordem, numero)
        cy.elementoMes('button, [role="button"], .container-button', 'Iniciar').should($botao => {
          expect($botao, 'controle Iniciar em Receber Ensacado').to.have.length(1)
          expect($botao.closest(':disabled, [disabled], [aria-disabled="true"], .disabled, .container-button-disabled')).to.have.length(0)
        }).click()
        aguardarFormularioLimpo()
        return cy.task('verificarRecebimentoEnsacados', { ...dados, aposIniciar: true }, { timeout: 60000 }).then(resultado => {
          expect(resultado, 'movimento de estoque da ordem ' + numero).to.exist
          cy.log('OR ' + numero + ' recebida. Evidência: ' + resultado.evidencia)
          return cy.screenshot(resultado.pasta + '/mes-ensacados-finalizado', { capture: 'viewport', overwrite: false })
        })
      })
    })
  })
}
