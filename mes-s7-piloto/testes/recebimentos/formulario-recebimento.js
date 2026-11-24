const painel = '[role="tabpanel"]:visible'
const lista = '.custom-dropdown-list:visible'

function campo(rotulo, escopo = painel) {
  return cy.get(escopo).contains('label', rotulo).parent().find('.custom-dropdown > .form-select')
}

function selecionar(rotulo, opcao, busca, escopo = painel) {
  campo(rotulo, escopo).should('have.length', 1).click()
  cy.get(lista).should('have.length', 1).then($lista => {
    const entrada = $lista.find('input:visible:enabled')
    if (busca && entrada.length === 1) cy.wrap(entrada).clear().type(busca)
  })
  cy.get(lista).contains(opcao).should('be.visible').click()
  return campo(rotulo, escopo).should($campo => expect($campo.text().trim()).to.match(opcao))
}

function abrirReceberGranel(modalidade, aba = modalidade) {
  const acesso = Cypress.expose('recebimento')
  if (acesso?.erro) throw new Error(acesso.erro)
  if (!acesso?.urlMes) throw new Error('Configuração de acesso ao MES indisponível para Recebimento.')
  const { urlMes, usuarioMes, erroSenhaMes } = acesso
  const timeout = 30000
  cy.visit(urlMes)
  cy.location('pathname', { timeout }).should('match', /\/(login|home)\/?$/i).then(caminho => {
    if (/\/home\/?$/i.test(caminho)) return
    cy.get('.form-select', { timeout }).should('be.visible').click()
    cy.get('[title=' + JSON.stringify(usuarioMes || 'ADMIN') + ']', { timeout })
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
  cy.location('pathname', { timeout }).should('match', /\/home\/?$/i)
  cy.contains('.text-navbar', /^Movimentação$/, { timeout }).should('be.visible').click()
  cy.contains(/^Receber Granel$/, { timeout }).should('be.visible').click()
  cy.elementoMes('.dxbl-tabs-text-container .dxbl-tabs-text-overflow', aba, { ignorarAcentos: true })
    .should('have.length', 1).scrollIntoView().should('be.visible').click()
  cy.get(painel, { timeout }).contains('label', /^Recebimento:$/).should('be.visible')
}

function prepararFormulario({ modalidade, ordem, produto, rota }) {
  const exato = texto => new RegExp('^' + Cypress._.escapeRegExp(texto) + '$')
  const destinoExato = new RegExp('^\\s*' + Cypress._.escapeRegExp(rota.destino) + '(?:\\s*[-–—:|]\\s*.+)?\\s*$', 'i')
  const numero = new RegExp('\\b' + ordem + '\\b')
  const caminho = new RegExp('^' + rota.rota.split(/\s*->\s*/).map(Cypress._.escapeRegExp).join('\\s*->\\s*') + '$')
  cy.log('OR ' + ordem + ' | ' + produto.nomeProduto + ' | rota ' + rota.codigo + ' | ' + rota.destino)
  selecionar(/^Recebimento:$/, exato(modalidade))
  selecionar(/^Ordem Recebimento:$/, numero, ordem)
  campo(/^Destino:$/).then($campo => {
    if (!destinoExato.test($campo.text().trim())) selecionar(/^Destino:$/, destinoExato, rota.destino)
  })
  campo(/^Rota:$/).then($campo => {
    if (!caminho.test($campo.text().trim())) selecionar(/^Rota:$/, caminho)
  })
  campo(/^Destino:$/).should($campo => expect($campo.text().trim()).to.match(destinoExato))
  campo(/^Rota:$/).should($campo => expect($campo.text().trim()).to.match(caminho))
}

module.exports = { painel, abrirReceberGranel, prepararFormulario, selecionar }
