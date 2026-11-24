require('../../comum/consultas-mes')
const { acessarMes, abrirListaDeOrdens } = require('./acesso-ordem')
const { localizarOpcaoProduto } = require('./opcao-produto')
const timeout = 30000

Cypress.Commands.addQuery('opcaoProdutoDaOrdem', function (codigo, nome) {
  this.set('timeout', timeout)
  return () => Cypress.$(localizarOpcaoProduto(cy.state('document'), codigo, nome, Cypress.dom.isVisible))
})

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

const linhas = 'tr:visible, [role="row"]:visible'
const celulas = 'td, [role="gridcell"]'

function linhaDoItemEmEdicao() {
  return cy.get(linhas, { timeout }).filter((_, linha) => {
    const textos = [...linha.querySelectorAll('button, a, [role="button"]')]
      .filter(Cypress.dom.isVisible).map(el => normalizarRotulo(el.textContent))
    return textos.includes('salvar') && textos.includes('cancelar')
  }).should('have.length', 1)
}

function celulaDoItem(rotulo, nome) {
  return linhaDoItemEmEdicao().should($linha => {
    expect(indiceColunaDoItem($linha[0], rotulo), 'coluna ' + nome).to.be.at.least(0)
  }).then($linha => cy.wrap($linha).children(celulas).eq(indiceColunaDoItem($linha[0], rotulo)))
}

function campoDoItem(rotulo, nome) {
  return celulaDoItem(rotulo, nome).find('input:visible:enabled').should('have.length', 1)
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

const colunaQuantidade = /^(?:quantidade|qtd\.?)$/
const colunaDisponivel = /^(?:quantidade|qtd\.?)\s+(?:disponivel|disp\.?)$/
const colunaPesoUnitario = /^peso\s+unit(?:ario|\.)?(?:\s+(?:da\s+)?nf)?$/

function preencherValoresEnsacados(quantidade, pesoUnitarioKg) {
  campoDoItem(colunaQuantidade, 'Quantidade').clear().type(String(quantidade)).blur()
  campoDoItem(colunaPesoUnitario, 'Peso Unitário').clear().type(String(pesoUnitarioKg)).blur()
  celulaDoItem(colunaDisponivel, 'Quantidade Disponível').then($celula => {
    const $editavel = $celula.find('input:visible:enabled:not([readonly])')
    if (!$editavel.length) return
    expect($editavel, 'campo editável de Quantidade Disponível').to.have.length(1)
    return cy.wrap($editavel).clear().type(String(quantidade)).blur()
  })
  return celulaDoItem(colunaDisponivel, 'Quantidade Disponível').should($celula => {
    const valor = $celula.find('input:visible').val() ?? $celula.text()
    expect(pesoEmKg(String(valor)), 'quantidade disponível igual à quantidade').to.equal(quantidade)
  })
}

const colunaFornecedor = /^fornecedor$/
const colunaNota = /^(?:nf|nota fiscal)$/
const colunaFabricacao = /^dat[.a]?\s+(?:de\s+)?fab(?:ricacao|\.)?$/
const colunaValidade = /^dat[.a]?\s+(?:de\s+)?val(?:idade|\.)?$/

const dataBr = iso => iso.split('-').reverse().join('/')

function preencherDataDoItem(coluna, nome, iso) {
  return campoDoItem(coluna, nome).then($campo => {
    const valor = $campo[0].type === 'date' ? iso : dataBr(iso)
    return cy.wrap($campo).clear().type(valor).blur()
  })
}

function preencherComplementosEnsacados({ fornecedor, notaFiscal, fabricacao, validade }) {
  celulaDoItem(colunaFornecedor, 'Fornecedor').then($celula => {
    const $controle = $celula.find('.form-select:visible, [role="combobox"]:visible').first()
    return cy.wrap($controle.length ? $controle : $celula.find('button:visible').first()).should('be.visible').click()
  })
  const nomeExato = new RegExp('^\\s*' + Cypress._.escapeRegExp(fornecedor) + '\\s*$', 'i')
  cy.contains(nomeExato, { timeout }).should('be.visible').click()
  campoDoItem(colunaNota, 'NF').clear().type(notaFiscal).blur()
  preencherDataDoItem(colunaFabricacao, 'Data de Fabricação', fabricacao)
  preencherDataDoItem(colunaValidade, 'Data de Validade', validade)
}

function dadosFiscaisEnsacados(validadeDias) {
  const fabricacao = new Date()
  const validade = new Date(fabricacao)
  validade.setDate(validade.getDate() + validadeDias)
  const iso = data => [data.getFullYear(), data.getMonth() + 1, data.getDate()].map(n => String(n).padStart(2, '0')).join('-')
  return { notaFiscal: String(100000000 + Math.floor(Math.random() * 900000000)), fabricacao: iso(fabricacao), validade: iso(validade) }
}

function cadastrarItem(item) {
  const { codigoProduto, nomeProduto, pesoTotalNfKg, loteProduto, ensacados, quantidade, pesoUnitarioKg } = item
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
  if (ensacados) {
    preencherValoresEnsacados(quantidade, pesoUnitarioKg)
    preencherComplementosEnsacados(item)
  } else campoDoItem(colunaPeso, 'Peso Total NF').clear().type(String(pesoTotalNfKg)).blur()
  campoDoItem(colunaLote, 'Lote Fornecedor').clear().type(loteProduto).should('have.value', loteProduto).blur()
  linhaDoItemEmEdicao().contains('button, a, [role="button"]', /^\s*Salvar\s*$/).click()
  cy.contains(linhas, nomeProduto, { timeout }).should($linha => {
    expect($linha.text(), 'produto salvo na grade').to.include(codigoProduto)
    const indice = indiceColunaDoItem($linha[0], colunaPeso)
    expect(indice, 'coluna Peso Total NF').to.be.at.least(0)
    const pesoSalvo = $linha.children(celulas).eq(indice).text().trim()
    expect(pesoEmKg(pesoSalvo), 'peso total da NF salvo na grade').to.be.closeTo(pesoTotalNfKg, 0.000001)
    if (ensacados) {
      const texto = coluna => {
        const posicao = indiceColunaDoItem($linha[0], coluna)
        expect(posicao, 'coluna do item de Ensacados').to.be.at.least(0)
        return $linha.children(celulas).eq(posicao).text().trim()
      }
      expect(pesoEmKg(texto(colunaQuantidade)), 'quantidade salva').to.equal(quantidade)
      expect(pesoEmKg(texto(colunaDisponivel)), 'quantidade disponível salva').to.equal(quantidade)
      expect(pesoEmKg(texto(colunaPesoUnitario)), 'peso unitário salvo').to.be.closeTo(pesoUnitarioKg, 0.000001)
      expect(normalizarRotulo(texto(colunaFornecedor)), 'fornecedor salvo').to.include(normalizarRotulo(item.fornecedor))
      expect(texto(colunaNota).replace(/\D/g, ''), 'NF salva').to.equal(item.notaFiscal)
      for (const [coluna, data] of [[colunaFabricacao, item.fabricacao], [colunaValidade, item.validade]]) {
        expect(texto(coluna).split(/\s/)[0], 'data salva').to.be.oneOf([data, dataBr(data)])
      }
    }
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

function marcarEnsacados() {
  const rotulo = () => cy.contains('label.dx-like-checkbox', /^\s*Ensacados\s*$/, { timeout }).should('be.visible')
  const checkbox = $label => $label[0].control || $label[0].querySelector('input[type="checkbox"]')
  return rotulo().then($label => {
    const entrada = checkbox($label)
    expect(entrada?.type, 'checkbox associado ao rótulo Ensacados').to.equal('checkbox')
    if (!entrada.checked) return cy.wrap($label).click('left')
  }).then(() => rotulo().should($label => {
    expect(checkbox($label)?.checked, 'Ensacados marcado').to.equal(true)
  }))
}

function criarOrdem(cenario, { ensacados = false } = {}) {
  const item = { ...cenario, ensacados, loteProduto: gerarLote('L'),
    ...(ensacados ? dadosFiscaisEnsacados(cenario.validadeDias) : {}) }
  cy.task('iniciarEvidenciaOrdem', { item }).then(pasta => {
    evidencia = { pasta, etapa: 'Login', numero: null, item, confirmadaNaLista: false }
  })
  registrarEtapa('Login')
  acessarMes()
  registrarEtapa('Abrir formulário')
  abrirListaDeOrdens()
  cy.adicionarOrdem().should('have.length', 1).and('be.visible').click()
  cy.contains(/^Itens da Ordem de Recebimento$/, { timeout }).should('be.visible')
  if (ensacados) {
    registrarEtapa('Marcar Ensacados')
    marcarEnsacados()
  }
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
    cadastrarItem(item)
    registrarEtapa('Salvar cabeçalho')
    cy.elementoMes('button', 'Salvar').should('have.length', 1).and('be.enabled').click()
    registrarEtapa('Voltar à lista')
    voltarParaListaDeOrdens()
    registrarEtapa('Conferir número na listagem')
    conferirOrdemNaLista(numero).then(() => { evidencia.confirmadaNaLista = true })
    registrarEtapa('Ordem confirmada na listagem')
    cy.then(() => cy.screenshot(evidencia.pasta + '/ordem-' + numero + '-confirmada', { capture: 'viewport', overwrite: false }))
  })
}

module.exports = { criarOrdem }
