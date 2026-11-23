/* Versão inicial: uma rota por teste. Mantenha a VM e o supervisório visíveis. */
require('../../comum/consultas-mes')
describe('Transferir Granel - Rev 00', { testIsolation: false }, () => {
  const { mostrarMonitor, informarResultado, ocultarMonitor } = require('../../comum/visualizacao-monitor')
  const { abrirMonitorERetornar } = require('../../comum/abrir-monitor')
  const { acompanharNivelAlto } = require('../../comum/nivel-alto-mes')
  const { limparTransferencia } = require('../../comum/limpar-transferencia')
  const { aguardarEstadoTransferencias } = require('../../comum/aguardar-transferencias')
  const { recuperarEncerramento } = require('../../comum/recuperar-encerramento')
  const { preencherBusca } = require('../../comum/preencher-busca')
  const { avaliarResultadoBusca } = require('./resultado-busca')
  const { avaliarCartoes, TransferenciaAtivaNaPreparacao } = require('./seguranca-cartoes')
  const { tratarRecusaPartida } = require('./recusa-partida')
  const opcoesExecucao = Cypress.expose('execucao') || {}
  const pilotoS7 = Cypress.expose('pilotoS7') === true
  const rotas = Cypress.expose('rotas')
  const campo = {
    transferencia: ':nth-child(1) > .custom-dropdown > .form-select',
    origem: ':nth-child(2) > .custom-dropdown > .form-select',
    destino: ':nth-child(3) > .custom-dropdown > .form-select',
    rota: '[style="width: 31rem"] > .custom-dropdown > .form-select'
  }
  const execucao = { pronta: false, login: false, pasta: '', atual: null, anterior: null, inicioExecucao: null, inicioLogin: null, restauracaoFalhou: false, loginSeg: '', cardSeg: '', campoSeg: '' }
  const bloqueiosDePreparacao = new Map()
  const busca = 'input[placeholder="Buscar..."]:visible:enabled'

  function etapa(nome) { return cy.then(() => {
    execucao.atual.etapa = nome
    if (execucao.pasta) return cy.task('registrarEtapa', { pasta: execucao.pasta, codigo: execucao.atual.rota.codigo, etapa: nome }, { log: false })
  }) }
  function segundos(inicio) { return ((Date.now() - inicio) / 1000).toFixed(2) }
  function nomeSeguro(valor, limite = 60) { return valor.replace(/->/g, '-').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, limite) }
  function capturar(sufixo) {
    return cy.then(() => {
      const r = execucao.atual.rota
      const data = new Date().toISOString().replace(/[:.]/g, '-')
      const nome = `${nomeSeguro(r.codigo, 12)}-${nomeSeguro(r.local, 20)}-${nomeSeguro(r.nome, 20)}-${nomeSeguro(r.rota)}-${sufixo}-${data}`
      if (opcoesExecucao.capturaDesktop === false) {
        const arquivo = `${execucao.pasta}/${nome}`
        return cy.screenshot(arquivo, { capture: 'viewport', overwrite: false }).then(() => arquivo + '.png')
      }
      return cy.task('capturarTelas', { nome, pastaExecucao: execucao.pasta })
    }).then(arquivo => { execucao.atual.captura = arquivo })
  }
  // Usa somente a lista associada ao campo de busca aberto.
  function aguardarResultado(valor, prazo) {
    return cy.get('body').then($body => {
      const entradas = $body.find(busca).filter((_, el) => el.value === valor)
      const focadas = entradas.filter(':focus')
      const entrada = focadas.length === 1 ? focadas : entradas
      if (entrada.length !== 1) {
        if (Date.now() < prazo) return cy.wait(500, { log: false }).then(() => aguardarResultado(valor, prazo))
        throw new Error('Campo de busca ambíguo ou ainda não atualizado; opção não selecionada')
      }
      const paineis = entrada.parents().filter((_, elemento) => {
        if (elemento.tagName === 'BODY' || elemento.tagName === 'HTML') return false
        const painel = Cypress.$(elemento)
        const campos = painel.find(busca)
        const opcoes = painel.find('.dropdown-column:visible')
        const vazio = painel.find(':visible').filter((__, el) => el.textContent.trim() === 'Nenhum item encontrado.')
        return campos.length === 1 && (opcoes.length > 0 || vazio.length > 0)
      })
      const painel = paineis.first()
      if (painel.length) {
        const opcoes = painel.find('.dropdown-column:visible').filter((_, el) => el.textContent.trim() === valor)
        const vazio = painel.find(':visible').filter((__, el) => el.textContent.trim() === 'Nenhum item encontrado.')
        const decisao = avaliarResultadoBusca({ correspondencias: opcoes.length, vazio: vazio.length > 0, agora: Date.now(), prazo })
        if (decisao === 'encontrada') return cy.elementoMes('.dropdown-column', valor).click().then(() => 'encontrada')
        if (decisao === 'vazia') return 'vazia'

      }
      if (Date.now() >= prazo) return 'nao-confirmada'
      return cy.wait(500, { log: false }).then(() => aguardarResultado(valor, prazo))
    })
  }
  function selecionar(campoSeletor, valor, tipo) {
    etapa(`Selecionar ${tipo}`)
    cy.get(campoSeletor, { timeout: 30000 }).should('be.visible').click()
    // Reidentifica o campo após a atualização da tela; se houver mais de um,
    // usa apenas o que está em foco e nunca escolhe um campo arbitrariamente.
    cy.get(busca, { timeout: 30000 }).should($entradas => {
      expect($entradas.length === 1 || $entradas.filter(':focus').length === 1,
        'campo de busca único ou em foco').to.eq(true)
    }).then($entradas => {
      const seletor = $entradas.length === 1 ? busca : busca + ':focus'
      return preencherBusca({ cy, seletor, valor, modo: opcoesExecucao.modoBusca || 'estavel' })
    })
    if (opcoesExecucao.esperaBuscaMs) cy.wait(opcoesExecucao.esperaBuscaMs)
    return cy.then(() => aguardarResultado(valor, Date.now() + 8000)).then(resultado => {
      if (resultado === 'encontrada') return cy.get(campoSeletor, { timeout: 30000 }).should('contain.text', valor)
      return capturar(`${tipo}-busca-sem-opcao-exata`).then(() => {
        return cy.get(campoSeletor).should('be.visible').click().then(() => {
          if (resultado === 'vazia') throw new Error(`${tipo} não encontrado na busca: ${valor}`)
          throw new Error(`${tipo} não confirmado entre os resultados da busca: ${valor}`)
        })
      })
    })
  }
  function selecionarLocal(local) {
    etapa('Selecionar local')
    return cy.elementoMes('.dxbl-tabs-text-container > .dxbl-text', local, {
      ignorarAcentos: true, includeShadowDom: true
    }).click()
  }
  // Na preparação S7, só limpa cartão encerrado do nome esperado; não envia Parar.
  // Na parada normal, exige o nome da transferência iniciada pelo teste.
  function verificarEParar(nomePermitido = null, exigeAtiva = false, nivelAltoConfirmado = false, somenteLimpar = false) {
    return aguardarEstadoTransferencias({ cy, visivel: Cypress.dom.isVisible }).then(({ vazio, cartoes }) => {
      if (cartoes.some(c => c.ambiguo)) throw new Error('Cartão de transferência com identificação ambígua.')
      let decisao
      try {
        decisao = avaliarCartoes({
          vazio,
          cartoes: cartoes.map(c => ({ nome: c.nome, quantidadeBotoes: c.botoes.length,
            quantidadeLimpar: c.limpar.length, quantidadeSituacoes: c.situacoes })),
          nomePermitido, exigeAtiva, nivelAltoConfirmado, somenteLimpar
        })
      } catch (erro) {
        if (erro instanceof TransferenciaAtivaNaPreparacao) {
          const { local, codigo } = execucao.atual.rota
          const situacao = cartoes[0].textosSituacoes.join(', ')
          const diagnostico = `Local ${local}; cartão ${erro.nomeCartao}; situação ${situacao}; primeira rota bloqueada ${codigo}.`
          bloqueiosDePreparacao.set(local, diagnostico)
          erro.message += ' ' + diagnostico
        }
        throw erro
      }
      if (decisao === 'vazio') return
      if (pilotoS7 && !nomePermitido) {
        throw new Error('Já existe uma transferência no local. Libere o local antes do piloto.')
      }
      const cartao = cartoes[0]
      if (decisao === 'limpar') {
        execucao.atual.detalhes = [execucao.atual.detalhes, 'Cartão sem situação: tentativa de limpeza: ' + cartao.nome].filter(Boolean).join(' | ')
        return limparTransferencia({ cy, nome: cartao.nome, visivel: Cypress.dom.isVisible }).then(() => {
          execucao.atual.detalhes = [execucao.atual.detalhes, 'Limpeza confirmada: ' + cartao.nome].filter(Boolean).join(' | ')
        })
      }
      return solicitarParada(cartao).then(() => cy.contains('Não há nenhuma transferência em uso', { timeout: 30000 }).should('be.visible')).then(() => {
        execucao.atual.detalhes = [execucao.atual.detalhes, 'Parada confirmada: ' + cartao.nome].filter(Boolean).join(' | ')
      })
    })
  }
  function solicitarParada(cartao, botaoConfirmado = null) {
    execucao.atual.detalhes = [execucao.atual.detalhes, 'Tentativa de parar transferência: ' + cartao.nome].filter(Boolean).join(' | ')
    const parar = botaoConfirmado
      ? cy.wrap(botaoConfirmado, { log: false })
      : cy.elementoMes('button', 'Parar', { cartao: cartao.nome })
    return parar.click({ timeout: 30000 }).then(() =>
      cy.elementoMes('button', 'Sim').click({ timeout: 30000 })
    )
  }
  function transferencia(rota) {
    etapa('Selecionar transferência')
    return cy.get(campo.transferencia, { timeout: 30000 })
      .should('be.visible')
      .then($el => {
        if ($el.text().trim() === rota.nome) return
        return selecionar(campo.transferencia, rota.nome, 'transferencia')
          .then(() => cy.get(campo.transferencia, { timeout: 30000 })
            .should('contain.text', rota.nome))
      })
  }
  function preparar(rota) {
    if (execucao.anterior) {
      cy.log('Verificando e parando a transferência da etapa anterior, se estiver em uso.')
      selecionarLocal(execucao.anterior.local)
      etapa('Recuperar transferência da rota anterior')
      verificarEParar()
      cy.then(() => { execucao.anterior = null })
    }
    selecionarLocal(rota.local)
    etapa('Verificar transferência ativa')
    if (pilotoS7) verificarEParar(rota.nome, false, false, true)
    else verificarEParar()
    transferencia(rota)
    selecionar(campo.origem, rota.origem, 'origem')
    selecionar(campo.destino, rota.destino, 'destino')
    selecionar(campo.rota, rota.rota, 'rota')
    cy.get(campo.rota, { timeout: 30000 }).should('contain.text', rota.rota)
  }
  function iniciar(rota, tentativa = 0) {
    etapa('Verificar botão Iniciar')
    return cy.get('body').then($body => {
      const botoes = $body.find('button:visible').filter((_, el) => el.textContent.trim() === 'Iniciar')
      if (botoes.length === 1) {
        execucao.atual.inicioRota = Date.now()
        execucao.anterior = { local: rota.local, nome: rota.nome }
        cy.elementoMes('button', 'Iniciar').click()
        return
      }
      if (botoes.length > 1 || tentativa) throw new Error('Botão Iniciar ausente ou ambíguo após limpeza')
      execucao.atual.detalhes = 'Botão Iniciar ausente; formulário limpo e rota preparada novamente'
      cy.contains('Não há nenhuma transferência em uso', { timeout: 30000 }).should('be.visible')
      cy.elementoMes('button', 'Limpar').click()
      cy.get(campo.transferencia).should('not.contain.text', rota.nome)
      preparar(rota)
      return iniciar(rota, 1)
    })
  }
  function verificarRecusaPartida(falharTeste = true, durantePartidaS7 = false) {
    const atual = execucao.atual
    const rearmar = falharTeste && durantePartidaS7 && Cypress.expose('rearmarRecusaPlcsim') === true &&
      atual.rota.nivelAlto?.aplicavel && atual.rota.nivelAlto.status !== '---' && !atual.rearmeTentado
    return tratarRecusaPartida({ cy, execucao, visivel: Cypress.dom.isVisible, ocultarMonitor, falharTeste: falharTeste && !rearmar })
      .then(recusou => {
        if (!recusou || !rearmar) return recusou
        atual.rearmeTentado = true
        const { rota } = atual
        const primeiraRecusa = `Primeira partida recusada: nível alto em ${rota.destino}. Evidência: ${atual.captura}.`
        return etapa(primeiraRecusa).then(() => {
          // A tarefa pode escrever na LSH antes de falhar. Libere o lote só com retorno confirmado.
          execucao.restauracaoFalhou = true
          return cy.task('rearmarRecusaNivelAltoS7', { codigo: rota.codigo }, { timeout: 25000 })
        }).then(resultado => {
          execucao.restauracaoFalhou = false
          const detalhe = `Rearme PLCSIM ${resultado.address}: ${Number(resultado.anterior)} → ${Number(resultado.valorNormal)}, ${resultado.escrita ? 'escrita confirmada' : 'entrada já normal'}, Alm/Aviso inativos. Nova tentativa da mesma rota.`
          atual.detalhes += ' | ' + detalhe
          return etapa(detalhe)
        }).then(() => {
          atual.recusaPartida = false
          preparar(rota)
          prepararLeituraS7(rota)
          iniciar(rota)
          mostrarMonitor(rota.codigo)
        })
      })
  }
  function acompanharS7() {
    return cy.then(() => verificarRecusaPartida(true, true)).then(() => cy.task('confirmarS7', {
      inicio: execucao.atual.inicioRota
    }, { timeout: 10000 })).then(resultado => {
      return informarResultado(resultado).then(() => {
        if (resultado.concluido) return resultado
        return cy.wait(resultado.intervaloConsultaMs, { log: false }).then(() => acompanharS7())
      })
    })
  }

  function aguardarIniciado(rota) {
    etapa('Aguardar iniciado após conferir equipamentos')
    cy.then(() => { execucao.atual.inicioStatus = Date.now() })
    const limite = Date.now() + 100000
    function acompanharMes() {
      return verificarRecusaPartida().then(() => cy.get('body', { log: false })).then($body => {
        const nomes = $body.find('.row > :nth-child(1) > :nth-child(2):visible').filter((_, el) => el.textContent.trim() === rota.nome)
        if (nomes.length > 1) throw new Error('Cartão da transferência ambíguo.')
        const situacoes = nomes.eq(0).closest('.row').find('.card-situations:visible').filter((_, el) => el.textContent.trim() === 'Iniciado')
        if (nomes.length === 1 && situacoes.length === 1) {
          execucao.atual.cartaoIniciado = nomes.eq(0).closest('.row')[0]
          return
        }
        if (Date.now() >= limite) throw new Error('Prazo para confirmar Iniciado no MES esgotado.')
        return cy.wait(500, { log: false }).then(acompanharMes)
      })
    }
    acompanharMes()
    return cy.then(() => { execucao.atual.inicio = segundos(execucao.atual.inicioStatus) })
  }

  function prepararLeituraS7(rota) {
    etapa('Preparar leitura S7')
    cy.log('S7: consultando SQL, carregando catálogo do projeto e verificando as saídas antes da partida')
    return cy.task('prepararS7', rota.codigo, { timeout: 150000 }).then(tags => {
      cy.log(`S7: ${tags.length} retornos mapeados; preparação conforme perfil de cada equipamento`)
      tags.forEach(tag => cy.log(`${tag.label} → ${tag.address} · modo ${tag.modoValidacao} · perfil ${tag.perfil} · tipo(s) SQL ${tag.equipamentos.map(e => e.tip_equipamento).join(", ")}`))
    })
  }

  function testar(rota) {
    cy.task('validarRotaLir', rota.codigo).then(info => {
      execucao.atual.validacaoLir = info
      cy.log(`LIR: rota ${info.codigo} · ${info.tipoExecucao} · Teste anterior ${info.statusInicial}`)
    })
    preparar(rota)
    if (pilotoS7) prepararLeituraS7(rota)
    iniciar(rota)
    if (pilotoS7) {
      etapa('Acompanhar saídas S7 desde a partida')
      mostrarMonitor(rota.codigo)
      acompanharS7().then(resultado => {
        execucao.atual.s7 = resultado
        execucao.atual.detalhes = [execucao.atual.detalhes, resultado.detalhe].filter(Boolean).join(' | ')
        return cy.task('salvarEvidenciaS7', { pasta: execucao.pasta }).then(arquivo => {
          execucao.atual.detalhes += ' | Evidência S7: ' + arquivo
          return informarResultado(resultado).then(paginas => {
            return cy.wrap(Array.from({ length: paginas }, (_, indice) => indice), { log: false }).each(pagina => {
              informarResultado(resultado, pagina)
              cy.screenshot(`${execucao.pasta}/s7-rota-${rota.codigo}-pagina-${pagina + 1}`, {
                capture: 'viewport', overwrite: false,
              })
            })
          })
        })
      })
      if (opcoesExecucao.esperaVisualS7Ms) cy.wait(opcoesExecucao.esperaVisualS7Ms)
      ocultarMonitor()
      verificarRecusaPartida()
      cy.then(() => {
        if (execucao.atual.s7.ok) return aguardarIniciado(rota)
      })
    } else {
      aguardarIniciado(rota)
      if (opcoesExecucao.esperaMesSemS7Ms) cy.wait(opcoesExecucao.esperaMesSemS7Ms)
    }
    cy.then(() => {
      if (!pilotoS7 || execucao.atual.s7.ok) {
        etapa('Capturar supervisório')
        return capturar('iniciado')
      }
    })
    cy.then(() => { execucao.atual.normalConfirmado = !pilotoS7 || execucao.atual.s7?.ok === true })
    if (pilotoS7 && Cypress.expose('nivelAltoHabilitado') && rota.nivelAlto?.aplicavel && rota.nivelAlto.status !== '---') {
      cy.then(() => {
        if (!execucao.atual.normalConfirmado) return
        execucao.atual.etapa = 'Acionar LSH para nível alto'
        execucao.atual.nivelAltoExecutado = true
        return cy.task('acionarNivelAltoS7', null, { timeout: 10000 }).then(() => {
          execucao.atual.etapa = 'Aguardar Alm e Nível Alto no MES'
          mostrarMonitor(rota.codigo)
          return acompanharNivelAlto(rota, informarResultado)
        }).then(resultado => {
          execucao.atual.nivelAlto = resultado
          execucao.atual.etapa = 'Registrar reação ao nível alto'
          return informarResultado(resultado).then(paginas => cy.wrap(Array.from({ length: paginas }, (_, i) => i), { log: false }).each(pagina => {
            informarResultado(resultado, pagina)
            cy.screenshot(`${execucao.pasta}/nivel-alto-${rota.codigo}-${pagina + 1}`, { capture: 'viewport', overwrite: false })
          }))
        }).then(() => ocultarMonitor()).then(() => {
          cy.screenshot(`${execucao.pasta}/mes-nivel-alto-${rota.codigo}`, { capture: 'viewport', overwrite: false })
          return capturar('nivel-alto')
        }).then(() => cy.task('restaurarNivelAltoS7')).then(resultado => {
          execucao.atual.restauracaoLSH = resultado
          if (!resultado.ok) { execucao.restauracaoFalhou = true; throw new Error(resultado.detalhe) }
          execucao.atual.detalhes += ' | LSH, Alm e Nível Alto no MES confirmados; entrada restaurada.'
        })
      })
    }
    etapa('Finalizar transferência após as validações')
    cy.then(() => {
      execucao.atual.inicioParada = Date.now()
      execucao.atual.tentouParar = true
    })
    cy.then(() => verificarEParar(rota.nome, execucao.atual.nivelAlto?.ok !== true, execucao.atual.nivelAlto?.ok === true))
    cy.then(() => {
      execucao.atual.parada = segundos(execucao.atual.inicioParada)
      execucao.anterior = null
      if (pilotoS7 && !execucao.atual.s7.ok) {
        execucao.atual.etapa = 'Confirmar saídas S7'
        throw new Error(execucao.atual.s7.detalhe)
      }
    })
  }

  it('01 - Login - Rev 00', () => {
    cy.log(pilotoS7 ? 'Piloto 11.4 — MES + validação S7 ativa' : 'Piloto 11.4 — modo MES selecionado')
    if (pilotoS7) cy.task('validarCatalogoS7', null, { timeout: 150000 }).then(info => {
      cy.log(`Catálogo: ${info.origem} · ${info.catalogo?.name || 'projeto importado'} · ${info.declaracoes} declarações`)
      cy.log(`Identificação: ${info.catalogo?.id || 'Monitor anterior sem identificação de catálogo'}`)
      info.sinaisLir.forEach(sinal => cy.log(`LSH ${sinal.sinal}: ${sinal.address || sinal.situacao} · Nível Alto ${sinal.statusLir}; fase de nível alto conforme configuração`))
    })
    cy.then(() => { execucao.inicioExecucao = Date.now(); execucao.inicioLogin = Date.now() })
    const mes = opcoesExecucao.urlMes || 'http://localhost/nexxus-mes'
    cy.visit(mes)
    if (pilotoS7) abrirMonitorERetornar(Cypress.expose('monitorS7'), mes)
    // Aguarda a aplicação identificar se já existe uma sessão.
    cy.location('pathname', { timeout: 30000 })
      .should('match', /\/(login|home)\/?$/i)
      .then((caminho) => {
        if (/\/home\/?$/i.test(caminho)) return

        cy.get('.form-select', { timeout: 30000 }).should('be.visible').click()
        cy.get('[title=' + JSON.stringify(opcoesExecucao.usuarioMes || 'ADMIN') + ']', { timeout: 30000 }).should('have.length', 1).should('be.visible').click()
        cy.env(['senhaMES']).then(({ senhaMES }) => {
          if (!senhaMES) throw new Error('Senha ausente: configure credenciais.local.json')
          cy.get('[name="loginModel.Password"]', { timeout: 30000 })
            .should('be.visible')
            .type(senhaMES, { log: false })
        })
        cy.get('.btn:visible', { timeout: 30000 }).should('have.length', 1)
        cy.get('.btn:visible', { timeout: 30000 }).click()
      })
    cy.url({ timeout: 30000 }).should('include', '/home')
    cy.then(() => { execucao.loginSeg = segundos(execucao.inicioLogin); execucao.login = true })
  })
  it('02 - Movimentação → Transferir Granel - Rev 00', function () {
    if (!execucao.login) this.skip()
    if (Cypress.expose('retomarPasta')) {
      cy.task('retomarRev00', Cypress.expose('retomarPasta')).then(pasta => { execucao.pasta = pasta })
    } else {
      cy.task('iniciarRev00').then(pasta => { execucao.pasta = pasta })
    }
    cy.contains('.text-navbar', 'Movimentação', { timeout: 30000 }).should('be.visible').click()
    cy.then(() => { execucao.inicioCard = Date.now() })
    cy.contains('Transferir Granel', { timeout: 30000 }).should('be.visible')
    cy.then(() => { execucao.cardSeg = segundos(execucao.inicioCard) })
    cy.contains('Transferir Granel', { timeout: 30000 }).click()
    cy.then(() => { execucao.inicioCampo = Date.now() })
    cy.get(campo.transferencia, { timeout: 30000 }).should('be.visible')
    cy.then(() => { execucao.campoSeg = segundos(execucao.inicioCampo) })
    cy.then(() => { execucao.pronta = true })
  })

  describe('Rotas', () => {
    beforeEach(function () {
      execucao.atual = null // Um teste pulado não pode registrar novamente a rota anterior.
      if (!execucao.pronta || execucao.registroFalhou) this.skip()
      if (pilotoS7 && (execucao.anterior || execucao.restauracaoFalhou)) {
        cy.log('Lote interrompido após falha com transferência sem encerramento confirmado.')
        this.skip()
      }
      execucao.atual = null
      // Observa o formulário; o tratamento do botão ocorre após selecionar a rota.
      cy.get('body').then($body => {
        const iniciar = $body.find('button:visible').filter((_, el) => el.textContent.trim() === 'Iniciar')
        cy.log(`Preparação: ${iniciar.length} botão(ões) Iniciar visível(is)`)
      })
    })
    afterEach(function () {
      if (pilotoS7) ocultarMonitor()
      if (!execucao.atual || !execucao.pasta) return
      const atual = execucao.atual
      const falhou = this.currentTest.state === 'failed'
      const erro = this.currentTest.err && this.currentTest.err.message
      const restauracao = pilotoS7 ? cy.task('restaurarNivelAltoS7', null, { timeout: 10000 }) : cy.wrap({ ok: true }, { log: false })
      return restauracao.then(result => {
        atual.restauracaoLSH = result
        if (!result.ok) { execucao.restauracaoFalhou = true; cy.log('RESTAURAÇÃO PENDENTE: ' + result.detalhe) }
        if (pilotoS7 && (atual.s7 || atual.nivelAltoExecutado)) return cy.task('salvarEvidenciaS7', { pasta: execucao.pasta })
      }).then(() => verificarRecusaPartida(false)).then(() => cy.task('registrarRev00', {
        pasta: execucao.pasta, data: new Date().toLocaleString('pt-BR'), ...atual.rota,
        resultado: falhou || execucao.restauracaoFalhou ? 'Falhou' : 'Concluída', etapa: atual.etapa,
        resultadoNormal: atual.nivelAltoExecutado ? (atual.normalConfirmado ? 'Concluída' : 'Falhou') : (falhou || execucao.restauracaoFalhou ? 'Falhou' : 'Concluída'),
        nivelAltoExecutado: atual.nivelAltoExecutado === true,
        resultadoNivelAlto: atual.nivelAltoExecutado ? (!falhou && atual.nivelAlto?.ok && atual.restauracaoLSH?.ok ? 'Concluída' : 'Falhou') : null,
        tipoExecucao: atual.validacaoLir?.tipoExecucao || atual.rota.tipoExecucao,
        statusInicial: atual.validacaoLir?.statusInicial || atual.rota.statusInicial,
        detalhes: [atual.detalhes, erro].filter(Boolean).join(' | '),
        loginSeg: execucao.loginSeg, cardSeg: execucao.cardSeg, campoSeg: execucao.campoSeg,
        inicio: atual.inicio, parada: atual.parada,
        total: atual.inicioRota ? segundos(atual.inicioRota) : '',
        rotaCompleta: atual.inicioTeste ? segundos(atual.inicioTeste) : '',
        execucaoAteAgora: execucao.inicioExecucao ? segundos(execucao.inicioExecucao) : '', captura: atual.captura
      })).then(resultado => {
        if (resultado && resultado.aviso) {
          execucao.registroFalhou = true
          cy.log('REGISTRO PENDENTE: ' + resultado.aviso)
        }
        if (pilotoS7 && falhou && execucao.anterior && !atual.recusaPartida) {
          return recuperarEncerramento({
            cy, execucao, atual, visivel: Cypress.dom.isVisible,
            solicitarParada: cartao => solicitarParada(cartao, cartao.botoes[0]),
          })
        }
      })
    })
    rotas.forEach((rota, indice) => {
      it(`${indice + 1}/${rotas.length} | ${rota.codigo} | ${rota.local} | ${rota.nome} | ${rota.origem} → ${rota.destino} | Rev 00`, function () {
        const bloqueio = bloqueiosDePreparacao.get(rota.local)
        if (bloqueio) {
          Cypress.log({ name: 'Local bloqueado', message: bloqueio })
          this.skip()
          return
        }
        execucao.atual = { rota, etapa: 'Preparação', detalhes: '', captura: '', inicioTeste: Date.now() }
        testar(rota)
      })
    })
  })
})
