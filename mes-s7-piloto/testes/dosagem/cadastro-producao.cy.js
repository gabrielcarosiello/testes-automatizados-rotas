// Spec preparada com Cypress Author em 25/11/2026.
require('../../comum/consultas-mes')
const { acessarMes } = require('../ordens-recebimento/acesso-ordem')

const timeout = 30000
const painel = '[role="tabpanel"]:visible'
const combos = '.form-select, select, [role="combobox"]'
const entradas = 'input:not([type="hidden"])'
const rota = /^RC60\s*->\s*RC61\s*->\s*RC62\s*->\s*RC64\s*->\s*RC65\s*->\s*RC67\s*->\s*ME01$/
const texto = el => el.textContent.replace(/\s+/g, ' ').trim()
const valor = el => el.tagName === 'SELECT'
  ? el.selectedOptions[0]?.textContent.trim() || ''
  : el.value ?? (el.querySelector('input')?.value || texto(el))

Cypress.Commands.addQuery('campoProducao', function (rotulo, seletor, quantidade, indice) {
  this.set('timeout', timeout)
  return () => {
    const doc = cy.state('document')
    const visivel = Cypress.dom.isVisible
    const textos = 'label, span, div, td, h1, h2, h3, h4, h5, h6, b, strong'
    const rotulos = [...doc.querySelectorAll(textos)].filter(el =>
      visivel(el) && rotulo.test(texto(el)) && ![...el.children].some(filho => rotulo.test(texto(filho))))
    const modais = rotulos.filter(el => el.closest('[role="dialog"], [aria-modal="true"], .dxbl-modal'))
    const candidatos = modais.length ? modais : rotulos
    const campos = new Set()
    for (const label of candidatos) {
      if (quantidade === 1 && label.control?.matches(seletor) && visivel(label.control)) {
        campos.add(label.control)
        continue
      }
      const limite = label.closest('[role="dialog"], [aria-modal="true"], .dxbl-modal') || doc.body
      for (let grupo = label; grupo && grupo !== limite; grupo = grupo.parentElement) {
        const elementos = [...grupo.querySelectorAll(seletor)].filter(visivel)
        const externos = elementos.filter(el => !elementos.some(outro => outro !== el && outro.contains(el)))
        if (externos.length > quantidade) break
        if (externos.length === quantidade) {
          campos.add(externos[indice])
          break
        }
      }
    }
    return Cypress.$([...campos])
  }
})

Cypress.Commands.addQuery('confirmarProducao', function () {
  this.set('timeout', timeout)
  return () => {
    const doc = cy.state('document')
    const acao = 'button, [role="button"], input[type="submit"], a, .container-button'
    const rotulos = [...doc.querySelectorAll('input[type="submit"], button, a, div, span, label, [role="button"]')].filter(el =>
      Cypress.dom.isVisible(el) && /^Confirmar$/i.test(el.tagName === 'INPUT' ? el.value : texto(el)) &&
      ![...el.children].some(filho => Cypress.dom.isVisible(filho) && /^Confirmar$/i.test(texto(filho))))
    const modais = rotulos.filter(el => el.closest('[role="dialog"], [aria-modal="true"], .dxbl-modal'))
    return Cypress.$([...new Set((modais.length ? modais : rotulos).map(el => el.closest(acao) || el))])
  }
})

const campo = (rotulo, seletor, quantidade = 1, indice = 0) =>
  cy.campoProducao(rotulo, seletor, quantidade, indice).should($campo => expect($campo, 'campo ' + rotulo).to.have.length(1))

function selecionar(consultar, opcao, busca) {
  return consultar().then($campo => {
    const el = $campo[0]
    if (opcao.test(valor(el))) return
    if (el.tagName === 'SELECT') {
      const opcoes = [...el.options].filter(item => opcao.test(texto(item)))
      expect(opcoes, 'opção única para ' + opcao).to.have.length(1)
      return cy.wrap($campo).select(opcoes[0].value)
    }

    cy.wrap($campo).click()
    const lista = () => cy.get('.custom-dropdown-list:visible, [role="listbox"]:visible', { timeout })
      .filter((_, el) => !el.parentElement?.closest('.custom-dropdown-list, [role="listbox"]'))
      .should('have.length', 1)
    if (busca) lista().then($lista => {
      const entrada = $lista.find('input:visible:enabled')
      if (entrada.length === 1) return cy.wrap(entrada).clear().type(busca)
    })
    return lista().contains(opcao, { timeout, includeShadowDom: true }).should('be.visible').then($opcao => {
      const item = $opcao[0].closest('tr, [role="row"], [role="option"], .dxbl-grid-data-row')
      return cy.wrap(item && Cypress.dom.isVisible(item) ? item : $opcao[0]).click('left')
    })
  }).then(() => consultar().should($campo => expect(valor($campo[0])).to.match(opcao)))
}

function conferirPeso(rotulo, esperado) {
  campo(rotulo, entradas).should($campo => {
    const kg = valor($campo[0]).replace(/\s|kg/gi, '').replace(/\.(?=\d{3}(?:[.,]|$))/g, '').replace(',', '.')
    expect(Number(kg), 'peso em kg para ' + rotulo).to.equal(esperado)
  })
}

describe('Cadastro de produção — Rações RC', { testIsolation: true }, () => {
  let lote
  let etapaAtual

  function etapa(nome) {
    cy.then(() => {
      etapaAtual = nome
      return cy.task('registrarEvidenciaDosagem', { lote, tipo: 'etapa', etapa: nome }, { log: false })
    })
    cy.log(nome)
  }

  afterEach(function () {
    if (!lote) return
    const { state, err } = this.currentTest
    const falhou = state === 'failed'
    const mensagem = etapaAtual === 'Acessar MES' ? 'Falha ao acessar o MES.' : err?.message?.split('\n')[0]?.slice(0, 400)
    cy.task('registrarEvidenciaDosagem', {
      lote, tipo: 'resultado', etapa: etapaAtual, resultado: state, erro: falhou ? mensagem : undefined,
    }, { log: false }).then(arquivo => cy.log('Evidência: ' + arquivo))
    if (falhou) cy.screenshot('Dosagem_' + lote + '/falha', {
      capture: 'viewport', overwrite: false, blackout: ['input[type="password"]', '[name="loginModel.Password"]'],
    })
  })

  it('Cadastra 10 bateladas de CYPRESS RAC para ME01, sem OP', {
    viewportWidth: 1920,
    viewportHeight: 900,
  }, () => {
    lote = String(Date.now())
    etapaAtual = undefined
    cy.task('registrarEvidenciaDosagem', { lote, tipo: 'inicio' }, { log: false })
    etapa('Acessar MES')
    acessarMes()
    etapa('Abrir formulário Rações RC')
    cy.contains('.text-navbar', /^Produção$/, { timeout }).should('be.visible').click()
    cy.contains('.card-text', /^Produzir$/, { timeout }).should('be.visible').click()
    cy.elementoMes('.dxbl-tabs-text-container .dxbl-tabs-text-overflow', 'Rações RC')
      .should('have.length', 1).click()
    cy.elementoMes(painel + ' .container-button', 'Adicionar').should('have.length', 1).click()

    cy.log('Lote ' + lote + ' | CYPRESS RAC | ME01')
    etapa('Preencher lote')
    campo(/^Lote:?$/i, entradas + ':enabled:not([readonly])').clear().type(lote)
    etapa('Selecionar fórmula')
    selecionar(() => campo(/^Fórmula$/i, combos), /^CYPRESS RAC(?:\s*[-–]\s*.+)?$/i, 'CYPRESS RAC')
    etapa('Selecionar trajeto')
    selecionar(() => campo(/^Trajeto$/i, combos), /^Trajeto Rações$/i, 'Trajeto Rações')
    etapa('Preencher bateladas')
    campo(/^Bateladas$/i, entradas + ':enabled:not([readonly])').clear().type('10').blur()
    etapa('Selecionar destino e rota')
    const primeiro = /^1[º°]$/
    selecionar(() => campo(primeiro, combos, 2, 0), /^ME01$/i, 'ME01')
    selecionar(() => campo(primeiro, combos, 2, 1), rota)

    etapa('Conferir dados da produção')
    campo(/^Lote:?$/i, entradas + ':enabled:not([readonly])').should('have.value', lote)
    campo(/^Bateladas$/i, entradas + ':enabled:not([readonly])').should('have.value', '10')
    conferirPeso(/^Peso$/i, 230)
    conferirPeso(/^Total$/i, 2300)
    campo(/^Ordem de Produção$/i, entradas).should('have.value', '')
    campo(/^OP ERP$/i, entradas).should('have.value', '')

    etapa('Confirmar cadastro')
    cy.confirmarProducao().should($botao => {
      expect($botao, 'controle Confirmar da produção').to.have.length(1)
      expect($botao.closest(':disabled, [aria-disabled="true"], .disabled, .container-button-disabled'),
        'controle Confirmar habilitado').to.have.length(0)
    }).should('be.visible').click()
    etapa('Conferir produção na grade')
    cy.get(painel, { timeout }).find('tr, [role="row"]').filter((_, linha) =>
      [...linha.querySelectorAll('td, [role="gridcell"]')].some(celula => texto(celula) === lote)
    ).should('have.length', 1).and('contain.text', 'CYPRESS RAC').and('contain.text', 'ME01')
    cy.screenshot('Dosagem_' + lote + '/mes-producao-cadastrada', { capture: 'viewport', overwrite: false })
  })
})
