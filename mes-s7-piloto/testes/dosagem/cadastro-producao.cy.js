// Spec preparada com Cypress Author em 25/11/2026.
require('../../comum/consultas-mes')
const { localizarCamposProducao, opErpSemPreenchimento, producaoLiberada, localizarRotuloLiberacao, lerContagemBateladas, lerPassosDaProducao, passosAtivosDaProducao } = require('./campos-producao')
const { lerTesteProducao } = require('./teste-producao')
const { acessarMes } = require('../../comum/acesso-mes')
const { localizarConfirmarProducao, confirmarProducaoHabilitado } = require('./confirmar-producao')

const timeout = 30000
const bateladas = 1000
const intervaloAcompanhamentoMs = 15000
const limiteAcompanhamentoMs = 16 * 60 * 60 * 1000
const pesoBateladaKg = 230
const painel = '[role="tabpanel"]:visible'
const combos = '.form-select, select, [role="combobox"]'
const formula = /^CYPRESS RAC\s*[-–]\s*2$/i
const entradas = 'input:not([type="hidden"])'
const rota = /^RC60\s*->\s*RC61\s*->\s*RC62\s*->\s*RC64\s*->\s*RC65\s*->\s*RC67\s*->\s*ME01$/
const texto = el => el.textContent.replace(/\s+/g, ' ').trim()
const valor = el => el.tagName === 'SELECT'
  ? el.selectedOptions[0]?.textContent.trim() || ''
  : el.value ?? (el.querySelector('input')?.value || texto(el))

Cypress.Commands.addQuery('campoProducao', function (rotulo, seletor, quantidade, indice) {
  this.set('timeout', timeout)
  return () => Cypress.$(localizarCamposProducao(cy.state('document'), Cypress.dom.isVisible, rotulo, seletor, quantidade, indice))
})

Cypress.Commands.addQuery('confirmarProducao', function () {
  this.set('timeout', timeout)
  return () => Cypress.$(localizarConfirmarProducao(cy.state('document'), Cypress.dom.isVisible))
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

const rotuloLote = /^(?:Código\s*\|\s*)?Lote\s*:?$/i
const celulasGrade = 'td, [role="gridcell"]'

Cypress.Commands.addQuery('producaoPorLote', function (lote) {
  this.set('timeout', timeout)
  return () => {
    const $painel = Cypress.$(cy.state('document')).find(painel)
    return $painel.find('tr, [role="row"]').filter((_, linha) => {
      const celulas = [...linha.querySelectorAll(celulasGrade)].map(texto)
      return Cypress.dom.isVisible(linha) && /^\d+$/.test(celulas[0]) && celulas[1] === lote
    })
  }
})

function localizarDiagnostico(doc, producao) {
  const corresponde = el => texto(el).match(/^Produção:\s*(\d+)\s*\(CYPRESS RAC\s*[-–]\s*2\)$/i)?.[1] === producao
  const cabecalhos = [...doc.querySelectorAll('div, span, h1, h2, h3, h4, h5, strong')]
    .filter(el => Cypress.dom.isVisible(el) && corresponde(el) && ![...el.children].some(corresponde))
  if (cabecalhos.length !== 1) return
  for (let grupo = cabecalhos[0].parentElement; grupo && grupo !== doc.body; grupo = grupo.parentElement) {
    if ([...grupo.querySelectorAll('th, [role="columnheader"]')].some(el => /^Teste de produ[cç][aã]o$/i.test(texto(el)))) return grupo
  }
}

Cypress.Commands.addQuery('fecharTesteProducao', function (producao) {
  this.set('timeout', timeout)
  return () => {
    const doc = cy.state('document')
    const diagnostico = localizarDiagnostico(doc, producao)
    const modal = diagnostico?.closest('[role="dialog"], [aria-modal="true"], .dxbl-modal') || diagnostico
    const seletor = 'button, [role="button"], .dxbl-modal-close-button, .btn-close'
    return Cypress.$([...(modal?.querySelectorAll(seletor) || [])].filter(el =>
      Cypress.dom.isVisible(el) && (el.matches('.dxbl-modal-close-button, .btn-close') ||
        /^(?:Fechar|Close|x|×|✕|✖)$/i.test(el.getAttribute('aria-label') || el.title || texto(el)))))
  }
})

Cypress.Commands.addQuery('rotuloLiberacao', function () {
  this.set('timeout', timeout)
  return () => {
    const paineis = Cypress.$(cy.state('document')).find(painel)
    return Cypress.$([...paineis].flatMap(el => localizarRotuloLiberacao(el, Cypress.dom.isVisible)))
  }
})

function liberarLinha() {
  const rotulo = () => cy.rotuloLiberacao().should('have.length', 1).and('be.visible')
  const checkbox = label => label.control || label.querySelector('input[type="checkbox"]')
  return rotulo().then($label => {
    const controle = checkbox($label[0])
    expect(controle?.type, 'checkbox Liberada para Produção').to.equal('checkbox')
    expect(controle.disabled, 'liberação habilitada').to.equal(false)
    if (controle.checked) return
    return rotulo().closest('dxbl-check').find('.dxbl-checkbox-check-element').should($area => {
      expect($area, 'área clicável da liberação').to.have.length(1)
      const entrada = $area[0].querySelector('input[type="checkbox"]')
      expect(entrada, 'checkbox associado ao rótulo').to.equal($area[0].closest('dxbl-check').querySelector('label').control)
    }).should('be.visible').click()
  }).then(() => rotulo().should($label => {
    expect(checkbox($label[0])?.checked, 'linha liberada para produção').to.equal(true)
  }))
}

describe('Produção — Rações RC', { testIsolation: true, viewportWidth: 1920, viewportHeight: 900 }, () => {
  let lote
  let etapaAtual
  let producao

  function etapa(nome) {
    cy.then(() => {
      etapaAtual = nome
      return cy.task('registrarEvidenciaDosagem', { lote, tipo: 'etapa', etapa: nome, producao }, { log: false })
    })
    cy.log(nome)
  }

  afterEach(function () {
    if (!lote) return
    const { state, err } = this.currentTest
    const falhou = state === 'failed'
    const mensagem = etapaAtual === 'Acessar MES' ? 'Falha ao acessar o MES.' : err?.message?.split('\n')[0]?.slice(0, 400)
    cy.task('registrarEvidenciaDosagem', {
      lote, tipo: 'resultado', etapa: etapaAtual, producao, resultado: state, erro: falhou ? mensagem : undefined,
    }, { log: false }).then(arquivo => cy.log('Evidência: ' + arquivo))
    if (falhou) cy.screenshot('Dosagem_' + lote + '/falha', {
      capture: 'viewport', overwrite: false, blackout: ['input[type="password"]', '[name="loginModel.Password"]'],
    })
  })

  it('Agenda e acompanha 1.000 bateladas de CYPRESS RAC para ME01, sem OP', () => {
    lote = String(Date.now())
    etapaAtual = undefined
    producao = undefined
    cy.task('registrarEvidenciaDosagem', { lote, tipo: 'inicio' }, { log: false })
    etapa('Acessar MES')
    cy.then(() => acessarMes(Cypress.expose('criacaoOrdem') || Cypress.expose('recebimento'), { contexto: 'Dosagem' }))
    etapa('Fase 0 — Abrir formulário Rações RC')
    cy.contains('.text-navbar', /^Produção$/, { timeout }).should('be.visible').click()
    cy.contains('.card-text', /^Produzir$/, { timeout }).should('be.visible').click()
    cy.elementoMes('.dxbl-tabs-text-container .dxbl-tabs-text-overflow', 'Rações RC')
      .should('have.length', 1).click()
    cy.elementoMes(painel + ' .container-button', 'Adicionar').should('have.length', 1).click()

    cy.log('Lote ' + lote + ' | CYPRESS RAC | ME01')
    etapa('Preencher lote')
    campo(rotuloLote, entradas + ':enabled:not([readonly])').clear().type(lote)
    etapa('Selecionar fórmula')
    selecionar(() => campo(/^Fórmula$/i, combos), formula, 'CYPRESS RAC')
    etapa('Selecionar trajeto')
    selecionar(() => campo(/^Trajeto$/i, combos), /^Trajeto Rações$/i, 'Trajeto Rações')
    etapa('Preencher bateladas')
    campo(/^Bateladas$/i, entradas + ':enabled:not([readonly])').clear().type(String(bateladas)).blur()
    etapa('Selecionar destino e rota')
    const primeiro = /^1[º°]$/
    selecionar(() => campo(primeiro, combos, 2, 0), /^ME01$/i, 'ME01')
    selecionar(() => campo(primeiro, combos, 2, 1), rota)

    etapa('Conferir dados da produção')
    campo(rotuloLote, entradas + ':enabled:not([readonly])').should('have.value', lote)
    campo(/^Bateladas$/i, entradas + ':enabled:not([readonly])').should($campo => {
      expect(lerContagemBateladas($campo[0].value), 'quantidade de bateladas').to.equal(bateladas)
    })
    conferirPeso(/^Peso$/i, pesoBateladaKg)
    conferirPeso(/^Total$/i, bateladas * pesoBateladaKg)
    etapa('Conferir ausência de OP')
    campo(/^Ordem de Produção:?$/i, entradas).should('have.value', '')
    cy.document().should(doc => {
      expect(opErpSemPreenchimento(doc, Cypress.dom.isVisible), 'OP ERP ausente ou vazio').to.equal(true)
    })

    etapa('Confirmar cadastro')
    cy.confirmarProducao().should($botao => {
      expect($botao, 'controle Confirmar da produção').to.have.length(1)
      expect(confirmarProducaoHabilitado($botao[0]), 'controle Confirmar habilitado').to.equal(true)
    }).should('be.visible').click()
    etapa('Conferir produção na grade')
    cy.producaoPorLote(lote).should($linha => {
      expect($linha, 'produção do lote ' + lote + ' na grade de Rações RC').to.have.length(1)
      const celulas = [...$linha[0].querySelectorAll(celulasGrade)].map(texto)
      expect(celulas.some(celula => formula.test(celula)), 'CYPRESS RAC versão 2 na grade').to.equal(true)
      expect(celulas).to.include('ME01')
      const contagem = celulas.some(celula => {
        const partes = celula.split('/')
        return partes.length === 2 && lerContagemBateladas(partes[0]) === 0 && lerContagemBateladas(partes[1]) === bateladas
      })
      expect(contagem, 'zero bateladas realizadas de ' + bateladas + ' agendadas').to.equal(true)
      expect(producaoLiberada($linha[0], Cypress.dom.isVisible), 'selo Liberado na coluna Situação').to.equal(true)
    }).then($linha => {
      producao = texto($linha[0].querySelector(celulasGrade))
    })
    cy.screenshot('Dosagem_' + lote + '/mes-producao-cadastrada', { capture: 'viewport', overwrite: false })

    etapa('Fase 1 — Abrir Teste Produção')
    cy.producaoPorLote(lote).should('have.length', 1).click()
    cy.elementoMes(painel + ' .container-button', 'Teste Pr').should('have.length', 1).click()
    etapa('Ler diagnóstico do MES')
    cy.document({ timeout }).should(doc => {
      const diagnostico = localizarDiagnostico(doc, producao)
      expect(diagnostico, 'diagnóstico da produção ' + producao).to.exist
      const ordens = lerTesteProducao(diagnostico).insumos.map(insumo => insumo.ordem).sort()
      expect(ordens, 'ordens dos três insumos').to.deep.equal(['1', '2', '3'])
    }).then(doc => {
      const diagnostico = lerTesteProducao(localizarDiagnostico(doc, producao))
      cy.task('registrarEvidenciaDosagem', { lote, producao, tipo: 'diagnostico', etapa: etapaAtual, diagnostico }, { log: false })
      cy.screenshot('Dosagem_' + lote + '/teste-producao', { capture: 'viewport', overwrite: false })
      cy.then(() => {
        const bloqueados = diagnostico.insumos.filter(insumo => !/^ok$/i.test(insumo.situacao))
        const resumo = [...bloqueados.map(insumo => insumo.produto + ': ' + insumo.situacao), ...diagnostico.impedimentos]
        expect(diagnostico.aprovado, 'Teste Produção ' + producao + ': ' + resumo.join(' | ')).to.equal(true)
      })
    })

    etapa('Fase 2 — Fechar Teste Produção')
    cy.then(() => cy.fecharTesteProducao(producao).should('have.length', 1).click())
    cy.document({ timeout }).should(doc => {
      expect(localizarDiagnostico(doc, producao), 'diagnóstico fechado').not.to.exist
    })
    etapa('Liberar Rações RC para produção')
    cy.producaoPorLote(lote).should('have.length', 1)
    cy.then(liberarLinha)
    etapa('Abrir Passo de Produção')
    cy.contains('.text-navbar', /^Produção$/, { timeout }).should('be.visible').click()
    cy.contains('.card-text', /^Passo de Produção$/, { timeout }).should('be.visible').click()
    cy.elementoMes('.dxbl-tabs-text-container .dxbl-tabs-text-overflow', 'Rações RC').should('have.length', 1).click()
    etapa('Confirmar passo ativo da produção')
    const passos = $painel => [...$painel].flatMap(el =>
      passosAtivosDaProducao(el, { producao, lote, destino: 'ME01' }, Cypress.dom.isVisible))
    cy.get(painel, { timeout }).should($painel => {
      expect(passos($painel), 'passo ativo da produção ' + producao + ', lote ' + lote).not.to.be.empty
    }).then($painel => cy.task('registrarEvidenciaDosagem', {
      lote, producao, tipo: 'partida', etapa: etapaAtual, partida: passos($painel),
    }, { log: false }))
    cy.screenshot('Dosagem_' + lote + '/passo-de-producao', { capture: 'viewport', overwrite: false })
    etapa('Acompanhar produção no MES')
    cy.then(() => {
      const limite = Date.now() + limiteAcompanhamentoMs
      let anterior
      function acompanhar() {
        return cy.get(painel, { timeout, log: false }).then($painel => {
          const identidade = { producao, lote, destino: 'ME01' }
          const passos = [...$painel].flatMap(el => lerPassosDaProducao(el, identidade, Cypress.dom.isVisible))
          const estado = JSON.stringify(passos)
          const expirou = Date.now() >= limite
          if (estado !== anterior || expirou) {
            anterior = estado
            const situacao = expirou ? 'prazo-esgotado' : passos.length ? 'passos-observados' : 'sem-passo-visivel'
            cy.task('registrarEvidenciaDosagem', {
              lote, producao, tipo: 'acompanhamento', etapa: etapaAtual, acompanhamento: { situacao, passos },
            }, { log: false })
          }
          if (expirou) {
            return cy.then(() => { throw new Error('Acompanhamento encerrado após 16 horas. Confirmar conclusão do lote no silo ME01.') })
          }
          return cy.wait(intervaloAcompanhamentoMs, { log: false }).then(acompanhar)
        })
      }
      return acompanhar()
    })
  })
})
