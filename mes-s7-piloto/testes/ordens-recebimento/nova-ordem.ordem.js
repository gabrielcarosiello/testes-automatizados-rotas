// Spec preparado com Cypress Author em 24/11/2026.
require('../../comum/consultas-mes')
const { controleAdicionarOrdem } = require('./controle-adicionar')

Cypress.Commands.addQuery('adicionarOrdem', function () {
  this.set('timeout', 30000)
  return () => Cypress.$(controleAdicionarOrdem(cy.state('document'), Cypress.dom.isVisible))
})

const { localizarOpcaoProduto } = require('./opcao-produto')
const timeout = 30000

Cypress.Commands.addQuery('opcaoProdutoDaOrdem', function (codigo, nome) {
  this.set('timeout', timeout)
  return () => Cypress.$(localizarOpcaoProduto(cy.state('document'), codigo, nome, Cypress.dom.isVisible))
})

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

function gerarLote(prefixo) {
  return prefixo + Array.from(globalThis.crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function dadosDaOrdem() {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const letra = () => letras[Math.floor(Math.random() * letras.length)]
  const digito = () => Math.floor(Math.random() * 10)
  const placa = letra() + letra() + letra() + digito() + letra() + digito() + digito()
  return { lote: gerarLote('P'), placa }
}

const itemDeTeste = { codigoProduto: '34130CP|GR', nomeProduto: 'Milho CG Moído', pesoTotalNfKg: 1000 }
const linhas = 'tr:visible, [role="row"]:visible'
const celulas = 'td, [role="gridcell"]'

function linhaDoItemEmEdicao() {
  return cy.get(linhas, { timeout }).filter((_, linha) => {
    const textos = [...linha.querySelectorAll('button, a, [role="button"]')]
      .filter(Cypress.dom.isVisible).map(el => normalizarRotulo(el.textContent))
    return textos.includes('salvar') && textos.includes('cancelar')
  }).should('have.length', 1)
}

function campoDoItem(rotulo, nome) {
  return linhaDoItemEmEdicao().should($linha => {
    expect(indiceColunaDoItem($linha[0], rotulo), 'coluna ' + nome).to.be.at.least(0)
  }).then($linha => cy.wrap($linha).children(celulas).eq(indiceColunaDoItem($linha[0], rotulo))
    .find('input:visible:enabled').should('have.length', 1))
}

function indiceColunaDoItem(linha, corresponde) {
  const grade = linha.closest('[role="grid"], table')
  const encontrar = raiz => [...(raiz?.querySelectorAll('th, [role="columnheader"]') || [])]
    .find(el => [el, ...el.querySelectorAll('[title], [aria-label]')].some(rotulo =>
      [rotulo.textContent, rotulo.title, rotulo.getAttribute('aria-label')].some(texto =>
        corresponde.test(normalizarRotulo(texto)))))
  const cabecalho = encontrar(grade) || encontrar(linha.closest('.dx-datagrid'))
  return cabecalho?.cellIndex ?? (cabecalho ? [...cabecalho.parentElement.children].indexOf(cabecalho) : -1)
}

function pesoEmKg(texto) {
  const valor = texto.replace(/\s|kg/gi, '')
  return Number(valor.includes(',') ? valor.replace(/\./g, '').replace(',', '.') : valor.replace(/\.(?=\d{3}(?:\.|$))/g, ''))
}

function cadastrarItem({ codigoProduto, nomeProduto, pesoTotalNfKg }) {
  linhaDoItemEmEdicao().children(celulas).first()
    .find('.form-select:visible, [role="combobox"]:visible').first().should('be.visible').click()
  cy.get('input[placeholder^="Buscar"]:visible', { timeout })
    .should('have.length', 1).clear().type(nomeProduto, { parseSpecialCharSequences: false })
  cy.opcaoProdutoDaOrdem(codigoProduto, nomeProduto)
    .should($opcao => expect($opcao, 'opção ' + codigoProduto + ' na caixa de produtos').to.have.length(1))
    .click()
  cy.get('input[placeholder^="Buscar"]:visible').should('not.exist')

  const colunaPeso = /^peso\s+total\s+(?:da\s+)?nf$/
  const colunaLote = /^lote\s+(?:do\s+)?fornecedor$/
  const loteProduto = gerarLote('L')
  campoDoItem(colunaPeso, 'Peso Total NF').clear().type(String(pesoTotalNfKg)).blur()
  campoDoItem(colunaLote, 'Lote Fornecedor').clear().type(loteProduto).should('have.value', loteProduto).blur()
  linhaDoItemEmEdicao().contains('button, a, [role="button"]', /^\s*Salvar\s*$/).click()
  cy.contains(linhas, nomeProduto, { timeout }).should($linha => {
    expect($linha.text(), 'produto salvo na grade').to.include(codigoProduto)
    const indice = indiceColunaDoItem($linha[0], colunaPeso)
    expect(indice, 'coluna Peso Total NF').to.be.at.least(0)
    const pesoSalvo = $linha.children(celulas).eq(indice).text().trim()
    expect(pesoEmKg(pesoSalvo), 'peso total da NF salvo na grade').to.equal(pesoTotalNfKg)
    const indiceLote = indiceColunaDoItem($linha[0], colunaLote)
    expect(indiceLote, 'coluna Lote Fornecedor').to.be.at.least(0)
    expect($linha.children(celulas).eq(indiceLote).text().trim(), 'lote do produto salvo').to.equal(loteProduto)
    expect($linha.text(), 'item fora de edição').not.to.include('Cancelar')
  })
}

function linhaTemNumeroDaOrdem(linha, numero) {
  const textoCelula = celula => String(celula.textContent ?? '').replace(/[\s\u200b-\u200f\ufeff]/g, '')
  const seletor = celulas + ', [role="cell"], [role="rowheader"], [aria-colindex]'
  const dados = [...linha.children].filter(celula => celula.matches(seletor))
  const indice = indiceColunaDoItem(linha, /^(?:recebimento|ordem(?: de)? recebimento)$/)
  if (indice >= 0) {
    const aria = dados.find(celula => Number(celula.getAttribute('aria-colindex')) === indice + 1)
    return Boolean(aria || dados[indice]) && textoCelula(aria || dados[indice]) === numero
  }
  return dados.some(celula => textoCelula(celula) === numero)
}

function abrirListaDeOrdens() {
  cy.contains('.text-navbar', /^Movimentação$/, { timeout }).should('be.visible').click()
  return cy.contains(/^Ordem(?: de)? Recebimento$/, { timeout }).should('be.visible').click()
}

function voltarParaListaDeOrdens() {
  // O MES pode fechar o formulário automaticamente após Salvar.
  return cy.wait(2000).then(() => cy.get('body')).then($body => {
    const visiveis = $body.find('label, span, div, button, a').filter((_, el) => Cypress.dom.isVisible(el))
    const temTexto = texto => visiveis.toArray().some(el => normalizarRotulo(el.textContent) === texto)
    if (temTexto('ordens a partir de:')) return
    if (temTexto('itens da ordem de recebimento') && temTexto('voltar')) return cy.contains(/^\s*Voltar\s*$/, { timeout }).should('be.visible').click()
    return abrirListaDeOrdens()
  })
}

function conferirOrdemNaLista(numero) {
  cy.log('Conferindo a ordem ' + numero + ' na listagem do MES.')
  return cy.get(linhas + ', .dx-data-row:visible', { timeout }).should($linhas => {
    const encontradas = [...$linhas].filter(linha => linhaTemNumeroDaOrdem(linha, numero))
    expect(encontradas, 'ordem ' + numero + ' na coluna Recebimento da listagem').to.have.length(1)
  })
}

let evidencia

function registrarEtapa(etapa, numero) {
  return cy.then(() => {
    evidencia.etapa = etapa
    if (numero) evidencia.numero = numero
    return cy.task('registrarEvidenciaOrdem', evidencia)
  })
}

afterEach(function () {
  if (!evidencia) return
  const { state, err } = this.currentTest
  const falhou = state === 'failed'
  const dados = { ...evidencia, resultado: falhou ? 'Falhou' : state === 'passed' ? 'Concluída' : state, erro: err?.message ?? null }
  evidencia = undefined
  cy.task('registrarEvidenciaOrdem', dados)
  if (falhou) return cy.screenshot(dados.pasta + '/falha', {
    capture: 'viewport', overwrite: false, blackout: ['input[type="password"]', '[name="loginModel.Password"]'],
  })
})

it('Cria e confere uma ordem de recebimento de milho a granel', { viewportWidth: 1440, viewportHeight: 850 }, () => {
  cy.task('iniciarEvidenciaOrdem').then(pasta => { evidencia = { pasta, etapa: 'Login', numero: null } })
  registrarEtapa('Login')
  acessarMes()
  registrarEtapa('Abrir formulário')
  abrirListaDeOrdens()
  cy.adicionarOrdem().should('have.length', 1).and('be.visible').click()
  cy.contains(/^Itens da Ordem de Recebimento$/, { timeout }).should('be.visible')
  registrarEtapa('Preencher cabeçalho')
  const { lote, placa } = dadosDaOrdem()
  cy.campoDaOrdem(/^codigo(?:\s|[|¦:\/Il-])*lote:?$/i).should('have.length', 1).and('be.enabled').clear().type(lote).should('have.value', lote)
  cy.campoDaOrdem(/^placa:?$/).should('have.length', 1).and('be.enabled').clear().type(placa).should($campo => {
    expect($campo.val().replace(/[\s-]/g, '').toUpperCase()).to.equal(placa)
  })
  registrarEtapa('Liberar cabeçalho')
  cy.elementoMes('button', 'Liberar').should('have.length', 1).and('be.enabled').click()
  cy.adicionarOrdem().should($controle => {
    expect($controle, 'Adicionar item após liberar a ordem').to.have.length(1)
    expect($controle.closest(':disabled, [disabled], [aria-disabled="true"], .disabled')).to.have.length(0)
  })
  cy.campoDaOrdem(/^recebimento:?$/).should($campo => {
    expect($campo, 'número gerado da ordem').to.have.length(1)
    expect(String($campo.val() ?? '').trim()).to.match(/^[1-9]\d*$/)
  }).then($campo => {
    const numero = String($campo.val()).trim()
    registrarEtapa('Cadastrar item', numero)
    cy.adicionarOrdem().click()
    cadastrarItem(itemDeTeste)
    registrarEtapa('Salvar cabeçalho')
    cy.elementoMes('button', 'Salvar').should('have.length', 1).and('be.enabled').click()
    registrarEtapa('Voltar à lista')
    voltarParaListaDeOrdens()
    registrarEtapa('Conferir número na listagem')
    conferirOrdemNaLista(numero)
    cy.then(() => cy.screenshot(evidencia.pasta + '/ordem-' + numero + '-confirmada', { capture: 'viewport', overwrite: false }))
  })
})
