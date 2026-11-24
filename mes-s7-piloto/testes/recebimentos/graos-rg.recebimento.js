// Teste preparado com Cypress Author em 24/11/2026.
require('../../comum/consultas-mes')
const { mostrarMonitor, informarResultado, ocultarMonitor } = require('../../comum/visualizacao-monitor')
const { cartoesOcupados, estadoDeRetomada, painelRecebimentoLivre, estadoDeEncerramento, lerCartao, normalizarStatus, botoesComTexto, botoesConfirmacao } = require('./cartao-recebimento')
const { painel, abrirReceberGranel, prepararFormulario } = require('./formulario-recebimento')
const cenarios = require('./cenarios-prepartida.json')

function botaoIniciar() {
  return cy.elementoMes(painel + ' .container-button', 'Iniciar').should($botao => {
    expect($botao, 'controle Iniciar do painel de Recebimento').to.have.length(1)
    const bloqueado = $botao.closest(':disabled, [aria-disabled="true"], [disabled], .disabled')
    expect(bloqueado, 'controle Iniciar habilitado').to.have.length(0)
  })
}

function observarRecebimentoEmUso(recebimento, statusEsperado) {
  cy.get(painel).contains('h5', /^Recebimentos em uso:/).should('be.visible')
  return cy.get(painel, { timeout: 30000 }).should($painel => {
    const { cartoes, status } = lerCartao($painel[0], Cypress.dom.isVisible, recebimento)
    expect(cartoes, 'cartão visível da ordem ' + recebimento.ordem + ' para ' + recebimento.rota.destino).to.have.length(1)
    expect(status, 'status visível do recebimento').not.to.be.empty
    if (statusEsperado) expect(status.map(normalizarStatus)).to.include(normalizarStatus(statusEsperado))
  }).then($painel => cy.log('Ordem ' + recebimento.ordem + ' / ' + recebimento.rota.destino + ' — ' + lerCartao($painel[0], Cypress.dom.isVisible, recebimento).status.join(' | ')))
}

function aguardarEquipamentos(inicio) {
  return cy.task('confirmarEquipamentosRecebimentoS7', { inicio }, { timeout: 10000 }).then(resultado => {
    if (!resultado.concluido) {
      return cy.wait(resultado.intervaloConsultaMs, { log: false }).then(() => aguardarEquipamentos(inicio))
    }
    return resultado
  })
}

function verificarNivelAltoNoCartao(recebimento, resultado, expansao) {
  const ler = $painel => lerCartao($painel[0], Cypress.dom.isVisible, recebimento)
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
      .then(confirmacao => mostrarMonitor(recebimento.rota.codigo).then(() => confirmacao))
  })
}

function aguardarNivelAlto(recebimento, expansao = { realizada: false }) {
  return cy.task('consultarNivelAltoRecebimentoS7', null, { timeout: 10000 }).then(resultado =>
    informarResultado(resultado).then(() => {
      if (resultado.concluido && !resultado.ok) return resultado
      const continuar = () => cy.wait(resultado.intervaloConsultaMs, { log: false })
        .then(() => aguardarNivelAlto(recebimento, expansao))
      if (!resultado.ok || !resultado.confirmadoClp) return continuar()
      return verificarNivelAltoNoCartao(recebimento, resultado, expansao)
        .then(confirmacao => confirmacao || continuar())
    }))
}

function aguardarRecebimentoLivre() {
  return cy.get(painel, { timeout: 30000 }).should($painel => {
    expect(painelRecebimentoLivre($painel[0], Cypress.dom.isVisible), 'painel sem recebimento em uso').to.equal(true)
  })
}

function aguardarParandoOuPainelLivre(recebimento) {
  const lerEstado = $painel => estadoDeEncerramento($painel[0], Cypress.dom.isVisible, recebimento)
  return cy.get(painel, { timeout: 30000 })
    .should($painel => expect(lerEstado($painel), 'ordem Parando ou painel sem recebimento em uso').to.be.oneOf(['parando', 'livre']))
    .then($painel => cy.log('Estado de encerramento no MES: ' + lerEstado($painel)))
}

function confirmarDialogoRecebimento(mensagem, resposta) {
  const botoes = $body => botoesConfirmacao($body[0], mensagem, Cypress.dom.isVisible, resposta)
  return cy.get('body', { timeout: 30000 })
    .should($body => expect(botoes($body), mensagem).to.have.length(1))
    .then($body => cy.wrap(botoes($body)[0]).click())
}

function pararRecebimento(recebimento, respostaFinalizacao = 'Sim') {
  const botoesParar = $painel => {
    const { cartoes } = lerCartao($painel[0], Cypress.dom.isVisible, recebimento)
    return cartoes.length === 1 ? botoesComTexto(cartoes[0], 'Parar', Cypress.dom.isVisible) : []
  }
  return cy.get(painel, { timeout: 30000 })
    .should($painel => expect(botoesParar($painel), 'Parar no cartão ' + recebimento.ordem + ' / ' + recebimento.rota.destino).to.have.length(1))
    .then($painel => cy.wrap(botoesParar($painel)[0]).click())
    .then(() => confirmarDialogoRecebimento('Deseja realmente parar o recebimento ' + recebimento.modalidade + '?'))
    .then(() => confirmarDialogoRecebimento('A ordem de recebimento foi finalizada?', respostaFinalizacao))
}

function recuperarRecebimentoAntesDaPartida(recebimento) {
  const lerEstado = $painel => estadoDeRetomada($painel[0], Cypress.dom.isVisible, recebimento)
  return cy.task('exigirRestauracaoLivreRecebimento').then(() =>
    cy.get(painel, { timeout: 30000 }).should($painel => {
      expect(lerEstado($painel), 'estado do recebimento antes da retomada').not.to.equal('aguardando')
    })).then($painel => {
    const estado = lerEstado($painel)
    if (estado === 'livre') return
    if (estado === 'parando') return aguardarRecebimentoLivre()
    if (estado !== 'recuperar') {
      const [ocupado] = cartoesOcupados($painel[0], Cypress.dom.isVisible)
      if (ocupado) {
        const identificacao = ocupado.ordem ? ' OR ' + ocupado.ordem + (ocupado.destino ? ' em ' + ocupado.destino : '') + '.' : ''
        throw new Error('Recebimento ocupado.' + identificacao + ' Nova partida bloqueada.')
      }
      throw new Error('Recebimento ativo ou estado indefinido no MES. Confira a ordem antes de retomar ' + recebimento.ordem + '.')
    }
    return cy.get('body').then($body => {
      const dialogos = $body[0].querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"], .modal.show, .modal-content')
      if ([...dialogos].some(Cypress.dom.isVisible)) throw new Error('Há um diálogo aberto no MES. Confira a parada da ordem ' + recebimento.ordem + '.')
      return pararRecebimento(recebimento, 'Não')
        .then(() => aguardarRecebimentoLivre())
        .then(() => cy.log('OR ' + recebimento.ordem + ' recuperada sem marcar a finalização.'))
        .then(() => cy.screenshot('recebimento-' + recebimento.ordem + '-recuperado', { capture: 'viewport', overwrite: false }))
    })
  })
}

function aguardarFinalizacaoRecebimento(recebimento, pasta) {
  return pararRecebimento(recebimento)
    .then(() => aguardarParandoOuPainelLivre(recebimento))
    .then(() => cy.task('restaurarNivelAltoRecebimentoS7', null, { timeout: 30000 }))
    .then(resultado => {
      if (!resultado.ok) throw new Error(resultado.detalhe)
      cy.log('LSH ' + recebimento.rota.destino + ' restaurada. Aguardando o MES liberar o recebimento.')
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

function executarCenario(cenario) {
  return cy.task('planejarPrePartidaRecebimento', cenario.id).then(recebimento =>
    cy.env(['observarRecebimento']).then(({ observarRecebimento }) => {
    if (habilitado(observarRecebimento)) {
      abrirReceberGranel(recebimento.modalidade)
      return observarRecebimentoEmUso(recebimento)
    }
    const { ordem, rota, produto } = recebimento
    return cy.task('verificarRecebimentoNoSilo', {
      ordem, codigoRota: rota.codigo, destino: rota.destino, codigoProduto: produto.codigoProduto,
    }, { timeout: 60000 }).then(confirmado => {
      if (confirmado) return cy.log('OR ' + ordem + ' já recebida em ' + rota.destino + ' — ' + confirmado.pesoRecebido + ' kg. Evidência: ' + confirmado.evidencia)
      abrirReceberGranel(recebimento.modalidade)
      recuperarRecebimentoAntesDaPartida(recebimento)
      prepararFormulario(recebimento)
      cy.get(painel).contains(/^Não há nenhum recebimento em uso$/).should('be.visible')
      return cy.task('prepararRecebimentoS7', { ordem: recebimento.ordem, codigo: recebimento.rota.codigo }, { timeout: 150000 }).then(({ equipamentos, nivelAlto, codigo, pasta }) => {
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
        observarRecebimentoEmUso(recebimento, 'Iniciado')
        if (!nivelAlto) return
        return cy.task('acionarNivelAltoRecebimentoS7', null, { timeout: 10000 })
          .then(() => mostrarMonitor(codigo))
          .then(() => aguardarNivelAlto(recebimento))
          .then(resultado =>
            capturarMonitor(resultado, pasta, 'nivel-alto-' + codigo)
              .then(() => ocultarMonitor())
              .then(() => cy.screenshot(pasta + '/mes-nivel-alto-' + codigo, { capture: 'viewport', overwrite: false }))
              .then(() => {
                if (resultado.ok) return
                if (resultado.confirmadoClp) {
                  const silo = resultado.silo
                  const leitura = silo?.good ? ' ' + silo.label + ' (' + silo.address + ')=' + Number(silo.value) + '.' : ''
                  throw new Error('Nível alto confirmado no CLP e não confirmado no cartão do MES para a ordem ' + recebimento.ordem + ', rota ' + codigo + '.' + leitura
                    + ' Validar a atualização do estado do Recebimento no MES.')
                }
                throw new Error(resultado.detalhe)
              }))
          .then(() => aguardarFinalizacaoRecebimento(recebimento, pasta))
      })
    })
  }))
}

for (const cenario of cenarios) {
  it('Executa o ciclo do cenário ' + cenario.id, () => executarCenario(cenario))
}
