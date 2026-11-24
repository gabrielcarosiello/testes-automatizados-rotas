// Teste preparado com Cypress Author em 24/11/2026.
require('../../comum/consultas-mes')
const { mostrarMonitor, informarResultado, ocultarMonitor } = require('../../comum/visualizacao-monitor')
const { lerCartao, normalizarStatus, botoesComTexto, botoesConfirmacao } = require('./cartao-recebimento')
const modalidade = 'Recebimento Grãos RG'
const ordem = /\b9390\b/
const destino = /^MG01$/
const rota = /RG01\s*->\s*RG03\s*->\s*RG04\s*->\s*RG22\s*->\s*MG01/
const painel = '[role="tabpanel"]:visible'
const lista = '.custom-dropdown-list:visible'

function campo(rotulo) {
  return cy.get(painel).contains('label', rotulo).parent().find('.custom-dropdown > .form-select')
}

function selecionar(rotulo, opcao, busca) {
  campo(rotulo).should('have.length', 1).click()
  cy.get(lista).should('have.length', 1).then($lista => {
    const entrada = $lista.find('input:visible:enabled')
    if (busca && entrada.length === 1) cy.wrap(entrada).clear().type(busca)
  })
  cy.get(lista).contains(opcao).should('be.visible').click()
  campo(rotulo).should($campo => expect($campo.text().trim()).to.match(opcao))
}

function abrirReceberGranel() {
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
  cy.contains('[role="tab"]', modalidade, { timeout }).should('be.visible').click()
  cy.get(painel, { timeout }).contains('label', /^Recebimento:$/).should('be.visible')
}

function botaoIniciar() {
  return cy.elementoMes(painel + ' .container-button', 'Iniciar').should($botao => {
    expect($botao, 'controle Iniciar do painel de Recebimento').to.have.length(1)
    const bloqueado = $botao.closest(':disabled, [aria-disabled="true"], [disabled], .disabled')
    expect(bloqueado, 'controle Iniciar habilitado').to.have.length(0)
  })
}

function prepararOrdem() {

  selecionar(/^Recebimento:$/, /^Recebimento Grãos RG$/)
  selecionar(/^Ordem Recebimento:$/, ordem, '9390')
  selecionar(/^Destino:$/, destino)
  campo(/^Rota:$/).then($campo => {
    if (!rota.test($campo.text())) selecionar(/^Rota:$/, rota)
  })
  campo(/^Rota:$/).should($campo => expect($campo.text()).to.match(rota))
  botaoIniciar()
}


function observarRecebimentoEmUso(statusEsperado) {
  cy.get(painel).contains('h5', /^Recebimentos em uso:/).should('be.visible')
  return cy.get(painel, { timeout: 30000 }).should($painel => {
    const { cartoes, status } = lerCartao($painel[0], Cypress.dom.isVisible)
    expect(cartoes, 'cartão visível da ordem 9390 para MG01').to.have.length(1)
    expect(status, 'status visível do recebimento').not.to.be.empty
    if (statusEsperado) expect(status.map(normalizarStatus)).to.include(normalizarStatus(statusEsperado))
  }).then($painel => cy.log('Ordem 9390 / MG01 — ' + lerCartao($painel[0], Cypress.dom.isVisible).status.join(' | ')))
}

function aguardarEquipamentos(inicio) {
  return cy.task('confirmarEquipamentosRecebimentoS7', { inicio }, { timeout: 10000 }).then(resultado => {
    if (!resultado.concluido) {
      return cy.wait(resultado.intervaloConsultaMs, { log: false }).then(() => aguardarEquipamentos(inicio))
    }
    return resultado
  })
}

function verificarNivelAltoNoCartao(codigo, resultado, expansao) {
  const ler = $painel => lerCartao($painel[0], Cypress.dom.isVisible)
  const confirmar = $painel => {
    const statusMes = ler($painel).status.find(texto => normalizarStatus(texto) === normalizarStatus(resultado.statusMes))
    if (statusMes) return cy.task('confirmarNivelAltoRecebimentoS7', { statusMes })
    return false
  }
  return cy.get(painel).then($painel => {
    const { status, expandir } = ler($painel)
    const nivelVisivel = status.some(texto => normalizarStatus(texto) === normalizarStatus(resultado.statusMes))
    if (nivelVisivel || !expandir || expansao.realizada) return confirmar($painel)

    // O painel S7 cobre o controle no MES enquanto está visível.
    return ocultarMonitor()
      .then(() => cy.get(painel))
      .then($painelAtual => {
        const controle = ler($painelAtual).expandir
        if (!controle) return
        return cy.wrap(controle).click().then(() => { expansao.realizada = true })
      })
      .then(() => cy.get(painel).then(confirmar))
      .then(confirmacao => mostrarMonitor(codigo).then(() => confirmacao))
  })
}

function aguardarNivelAlto(codigo, expansao = { realizada: false }) {
  return cy.task('consultarNivelAltoRecebimentoS7', null, { timeout: 10000 }).then(resultado =>
    informarResultado(resultado).then(() => {
      if (resultado.concluido && !resultado.ok) return resultado
      const continuar = () => cy.wait(resultado.intervaloConsultaMs, { log: false })
        .then(() => aguardarNivelAlto(codigo, expansao))
      if (!resultado.ok || !resultado.confirmadoClp) return continuar()
      return verificarNivelAltoNoCartao(codigo, resultado, expansao)
        .then(confirmacao => confirmacao || continuar())
    }))
}

function aguardarRecebimentoLivre() {
  return cy.get(painel, { timeout: 30000 }).should($painel => {
    const visiveis = [...$painel[0].querySelectorAll('.card-situations')].filter(Cypress.dom.isVisible)
    expect(visiveis, 'cartões ativos no painel de Recebimento').to.have.length(0)
  }).contains(/^Não há nenhum recebimento em uso$/).should('be.visible')
}

function confirmarDialogoRecebimento(mensagem) {
  const botoes = $body => botoesConfirmacao($body[0], mensagem, Cypress.dom.isVisible)
  return cy.get('body', { timeout: 30000 })
    .should($body => expect(botoes($body), mensagem).to.have.length(1))
    .then($body => cy.wrap(botoes($body)[0]).click())
}

function pararRecebimento() {
  const botoesParar = $painel => {
    const { cartoes } = lerCartao($painel[0], Cypress.dom.isVisible)
    return cartoes.length === 1 ? botoesComTexto(cartoes[0], 'Parar', Cypress.dom.isVisible) : []
  }
  return cy.get(painel, { timeout: 30000 })
    .should($painel => expect(botoesParar($painel), 'Parar no cartão 9390 / MG01').to.have.length(1))
    .then($painel => cy.wrap(botoesParar($painel)[0]).click())
    .then(() => confirmarDialogoRecebimento('Deseja realmente parar o recebimento Recebimento Grãos RG?'))
    .then(() => confirmarDialogoRecebimento('A ordem de recebimento foi finalizada?'))
}

function aguardarFinalizacaoRecebimento(pasta) {
  return pararRecebimento()
    .then(() => observarRecebimentoEmUso('Parando'))
    .then(() => cy.task('restaurarNivelAltoRecebimentoS7', null, { timeout: 30000 }))
    .then(resultado => {
      if (!resultado.ok) throw new Error(resultado.detalhe)
      cy.log('LSH MG01 restaurada. Aguardando o MES liberar o recebimento.')
      return aguardarRecebimentoLivre()
    })
    .then(() => cy.screenshot(pasta + '/mes-recebimento-finalizado', { capture: 'viewport', overwrite: false }))
}

function capturarMonitor(resultado, pasta, nome) {
  return informarResultado(resultado).then(paginas =>
    cy.wrap(Array.from({ length: paginas }, (_, i) => i), { log: false }).each(pagina => {
      informarResultado(resultado, pagina)
      cy.screenshot(pasta + '/' + nome + '-pagina-' + (pagina + 1), { capture: 'viewport', overwrite: false })
    }))
}

let s7Preparado = false
afterEach(() => {
  if (!s7Preparado) return
  s7Preparado = false
  return cy.task('concluirEvidenciaRecebimentoS7', null, { timeout: 30000 }).then(resultado => {
    cy.log('Evidência S7: ' + resultado.evidencia)
    if (!resultado.ok) throw new Error(resultado.detalhe)
  })
})

function habilitado(valor) {
  return valor === true || valor === 'true'
}

it('Confere a ordem 9390 em Grãos RG para MG01', () => {
  abrirReceberGranel()
  cy.env(['observarRecebimento']).then(({ observarRecebimento }) => {
    if (habilitado(observarRecebimento)) return observarRecebimentoEmUso()
    prepararOrdem()
    cy.get(painel).contains(/^Não há nenhum recebimento em uso$/).should('be.visible')
    return cy.task('prepararRecebimentoS7', null, { timeout: 150000 }).then(({ equipamentos, nivelAlto, codigo, pasta }) => {
      s7Preparado = equipamentos
      let inicio
      cy.then(() => { inicio = Date.now() })
      botaoIniciar().click()
      if (equipamentos) {
        mostrarMonitor(codigo)
        cy.then(() => aguardarEquipamentos(inicio)).then(resultado =>
          capturarMonitor(resultado, pasta, 's7-rota-' + codigo).then(() => {
            if (!resultado.ok) throw new Error(resultado.detalhe)
            return cy.log(resultado.detalhe)
          }))
        ocultarMonitor()
      }
      observarRecebimentoEmUso('Iniciado')
      if (!nivelAlto) return
      return cy.task('acionarNivelAltoRecebimentoS7', null, { timeout: 10000 })
        .then(() => mostrarMonitor(codigo))
        .then(() => aguardarNivelAlto(codigo))
        .then(resultado =>
          capturarMonitor(resultado, pasta, 'nivel-alto-' + codigo)
            .then(() => ocultarMonitor())
            .then(() => cy.screenshot(pasta + '/mes-nivel-alto-' + codigo, { capture: 'viewport', overwrite: false }))
            .then(() => {
              if (resultado.ok) return
              if (resultado.confirmadoClp) {
                const silo = resultado.silo
                const leitura = silo?.good ? ' ' + silo.label + ' (' + silo.address + ')=' + Number(silo.value) + '.' : ''
                throw new Error('Nível alto confirmado no CLP e não confirmado no cartão do MES para a ordem 9390, rota 14.' + leitura
                  + ' Validar a atualização do estado do Recebimento no MES.')
              }
              throw new Error(resultado.detalhe)
            }))
        .then(() => aguardarFinalizacaoRecebimento(pasta))
    })
  })
})
