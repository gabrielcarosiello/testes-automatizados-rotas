/* Versão inicial: uma rota por teste. Mantenha a VM e o supervisório visíveis. */
require('../../comum/consultas-mes')
describe('Transferir Granel - Rev 00', { testIsolation: false }, () => {
  const { mostrarMonitor, informarResultado, ocultarMonitor } = require('../../comum/visualizacao-monitor')
  const { abrirMonitorERetornar } = require('../../comum/abrir-monitor')
  const { acompanharNivelAlto } = require('../../comum/nivel-alto-mes')
  const { limparTransferencia, aguardarEncerramento } = require('../../comum/limpar-transferencia')
  const { aguardarEstadoTransferencias } = require('../../comum/aguardar-transferencias')
  const { identificarTransferenciaInterrompida, diagnosticarELimparInterrompida, diagnosticarInicioDesabilitado } = require('../../comum/impedimento-transferencia')
  const { confirmarVazio } = require('../../comum/cartoes-mes')
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
  const divergenciasNivel = new Map()
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
  function aguardarResultado(valor, prazo, metricas) {
    return cy.get('body').then($body => {
      const entradas = $body.find(busca).filter((_, el) => el.value === valor)
      const focadas = entradas.filter(':focus')
      const entrada = focadas.length === 1 ? focadas : entradas
      if (entrada.length !== 1) {
        if (Date.now() < prazo) return cy.wait(500, { log: false }).then(() => aguardarResultado(valor, prazo, metricas))
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
        if (decisao === 'encontrada') {
          const inicioClique = Date.now()
          metricas.respostaMs = inicioClique - metricas.inicioResultado
          return cy.elementoMes('.dropdown-column', valor).click().then(() => {
            metricas.cliqueMs = Date.now() - inicioClique
            return 'encontrada'
          })
        }
        if (decisao === 'vazia') return 'vazia'

      }
      if (Date.now() >= prazo) return 'nao-confirmada'
      return cy.wait(500, { log: false }).then(() => aguardarResultado(valor, prazo, metricas))
    })
  }
  function selecionar(campoSeletor, valor, tipo) {
    const metricas = {}
    etapa(`Selecionar ${tipo}`)
    cy.get(campoSeletor, { timeout: 30000 }).should('be.visible').click()
    // Reidentifica o campo após a atualização da tela; se houver mais de um,
    // usa apenas o que está em foco e nunca escolhe um campo arbitrariamente.
    cy.get(busca, { timeout: 30000 }).should($entradas => {
      expect($entradas.length === 1 || $entradas.filter(':focus').length === 1,
        'campo de busca único ou em foco').to.eq(true)
    }).then($entradas => {
      const seletor = $entradas.length === 1 ? busca : busca + ':focus'
      const inicio = Date.now()
      return preencherBusca({ cy, seletor, valor, modo: opcoesExecucao.modoBusca || 'estavel' })
        .then(() => { metricas.preencherMs = Date.now() - inicio })
    })
    if (opcoesExecucao.esperaBuscaMs) cy.wait(opcoesExecucao.esperaBuscaMs)
    return cy.then(() => {
      metricas.inicioResultado = Date.now()
      return aguardarResultado(valor, metricas.inicioResultado + 8000, metricas)
    }).then(resultado => {
      const { preencherMs, respostaMs = Date.now() - metricas.inicioResultado, cliqueMs = 0 } = metricas
      const atual = execucao.atual
      const tentativa = atual.rearmeTentado ? 2 : 1
      const etapaBusca = `Busca ${tipo}, tentativa ${tentativa}, ${resultado}: preencher=${preencherMs} ms, resultado=${respostaMs} ms, selecionar=${cliqueMs} ms.`
      if (execucao.pasta) cy.task('registrarEtapa', { pasta: execucao.pasta, codigo: atual.rota.codigo, etapa: etapaBusca }, { log: false })
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
    return aguardarEstadoTransferencias({ cy, visivel: Cypress.dom.isVisible }).then(estado => {
      const { vazio, cartoes } = estado
      const visivel = Cypress.dom.isVisible
      const atual = execucao.atual
      const interrompida = pilotoS7 && nomePermitido === atual.rota.nome
        ? identificarTransferenciaInterrompida(estado, atual.rota)
        : null
      if (interrompida) {
        return diagnosticarELimparInterrompida({ cy, execucao, atual, identificada: interrompida, visivel })
      }
      if (cartoes.some(c => c.ambiguo)) throw new Error('Cartão de transferência com identificação ambígua.')
      if (!somenteLimpar && vazio && nomePermitido && (atual.cartaoIniciado || atual.nivelAlto?.ok === true)) {
        atual.detalhes = [atual.detalhes, 'MES já confirmou o local vazio antes do comando de encerramento.'].filter(Boolean).join(' | ')
        return
      }
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
      return solicitarParada(cartao).then(() => {
        execucao.atual.detalhes = [execucao.atual.detalhes, 'Parada confirmada: ' + cartao.nome].filter(Boolean).join(' | ')
      })
    })
  }
  function solicitarParada(cartao, botaoConfirmado = null) {
    if (cartao.botoes[0]?.matches(':disabled, [aria-disabled="true"]')) {
      throw new Error('Parar está desabilitado no MES. A transferência requer verificação.')
    }
    execucao.atual.tentouParar = true
    execucao.atual.detalhes = [execucao.atual.detalhes, 'Tentativa de parar transferência: ' + cartao.nome].filter(Boolean).join(' | ')
    const parar = botaoConfirmado
      ? cy.wrap(botaoConfirmado, { log: false })
      : cy.elementoMes('button', 'Parar', { cartao: cartao.nome })
    return parar.click({ timeout: 5000 }).then(() => aguardarEncerramento({ cy, acao: 'parar', visivel: Cypress.dom.isVisible }))
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
  function iniciar(rota, tentativa = 0, prazo = null) {
    if (prazo === null) {
      etapa('Verificar botão Iniciar')
      return cy.then(() => iniciar(rota, tentativa, Date.now() + 4000))
    }
    return cy.get('body').then($body => {
      const botoes = $body.find('button:visible').filter((_, el) => el.textContent.trim() === 'Iniciar')
      if (botoes.length === 1) {
        if (botoes[0].matches(':disabled, [aria-disabled="true"]')) {
          if (Date.now() < prazo) return cy.wait(250, { log: false }).then(() => iniciar(rota, tentativa, prazo))
          const condicoes = $body.find('[role="alert"]:visible, .validation-message:visible, .alert:visible')
            .toArray().map(el => el.textContent.trim()).filter(Boolean).join(' | ').slice(0, 500)
          return diagnosticarInicioDesabilitado({ cy, atual: execucao.atual, pilotoS7, condicoes, capturar })
        }
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
      atual.rota.nivelAlto?.aplicavel && atual.rota.nivelAlto.status !== '---' && !atual.rearmeTentado && !atual.rearmePrePartida
    const segundaComS7Normal = falharTeste && durantePartidaS7 && atual.rearmeTentado && atual.s7NormalNaRecusa
    return tratarRecusaPartida({ cy, execucao, visivel: Cypress.dom.isVisible, ocultarMonitor, falharTeste: falharTeste && !rearmar && !segundaComS7Normal })
      .then(recusou => {
        if (recusou && segundaComS7Normal) {
          return cy.task('verificarEstadoNivelS7', { codigo: atual.rota.codigo }).then(estado => {
            const detalhe = `Segunda recusa do MES em ${atual.rota.destino}. ${estado.detalhe}.`
            const registro = estado.normal ? detalhe + ' Divergência persistente com S7 normal. Destino adiado até o próximo lote.' : detalhe
            if (estado.normal) divergenciasNivel.set(JSON.stringify([atual.rota.local, atual.rota.destino]), registro)
            atual.detalhes += ' | ' + registro
            throw new Error(registro)
          })
        }
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
          atual.s7NormalNaRecusa = !resultado.escrita
          const detalhe = `Rearme PLCSIM ${resultado.address}: ${Number(resultado.anterior)} → ${Number(resultado.valorNormal)}, ${resultado.escrita ? 'escrita confirmada' : 'entrada já normal'}, Alm/Aviso inativos. Nova tentativa da mesma rota.`
          atual.detalhes += ' | ' + detalhe
          return etapa(detalhe)
        }).then(() => {
          atual.recusaPartida = false
          preparar(rota)
          prepararLeituraS7(rota)
          iniciar(rota)
          mostrarMonitor(rota.codigo)
        }).then(() => true)
      })
  }
  function acompanharS7() {
    return cy.then(() => verificarRecusaPartida(true, true)).then(() => cy.task('confirmarS7', {
      inicio: execucao.atual.inicioRota
    }, { timeout: 10000 })).then(resultado => {
      return informarResultado(resultado).then(() => {
        if (resultado.concluido) {
          return verificarRecusaPartida(true, true).then(repetiu => repetiu ? acompanharS7() : resultado)
        }
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
    const entrada = execucao.pasta ? { codigo: rota.codigo, pasta: execucao.pasta, rearmar: !execucao.atual.rearmeTentado } : rota.codigo
    return cy.task('prepararS7', entrada, { timeout: 150000 }).then(resultado => {
      if (resultado.erro) {
        if (resultado.pendente) execucao.restauracaoFalhou = true
        throw new Error(resultado.erro)
      }
      const tags = Array.isArray(resultado) ? resultado : resultado.tags
      if (resultado.rearme) {
        execucao.atual.rearmePrePartida = true
        const r = resultado.rearme
        const detalhe = `Rearme na pré-partida ${r.address}: ${Number(r.anterior)} → ${Number(r.valorNormal)}. LSH normal e Alm/Aviso inativos.`
        execucao.atual.detalhes = [execucao.atual.detalhes, detalhe].filter(Boolean).join(' | ')
        cy.task('registrarEtapa', { pasta: execucao.pasta, codigo: rota.codigo, etapa: detalhe }, { log: false })
      }
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
        etapa('Acionar LSH para nível alto')
        execucao.atual.nivelAltoExecutado = true
        return cy.task('acionarNivelAltoS7', null, { timeout: 10000 }).then(() => {
          etapa('Aguardar Alm e Nível Alto no MES')
          mostrarMonitor(rota.codigo)
          return acompanharNivelAlto(rota, informarResultado)
        }).then(resultado => {
          execucao.atual.nivelAlto = resultado
          const silo = resultado.silo
          if (silo) {
            const leitura = silo.good ? `${silo.label} (${silo.address})=${Number(silo.value)}` : (silo.detalhe || 'leitura indisponível')
            execucao.atual.detalhes += ' | DB11: ' + leitura + '.'
          }
          etapa('Registrar reação ao nível alto')
          return informarResultado(resultado).then(paginas => cy.wrap(Array.from({ length: paginas }, (_, i) => i), { log: false }).each(pagina => {
            informarResultado(resultado, pagina)
            cy.screenshot(`${execucao.pasta}/nivel-alto-${rota.codigo}-${pagina + 1}`, { capture: 'viewport', overwrite: false })
          }))
        }).then(() => ocultarMonitor()).then(() => {
          cy.screenshot(`${execucao.pasta}/mes-nivel-alto-${rota.codigo}`, { capture: 'viewport', overwrite: false })
          return capturar('nivel-alto')
        }).then(() => etapa('Restaurar LSH após ensaio')).then(() => cy.task('restaurarNivelAltoS7')).then(resultado => {
          execucao.atual.restauracaoLSH = resultado
          if (!resultado.ok) { execucao.restauracaoFalhou = true; throw new Error(resultado.detalhe) }
          execucao.atual.detalhes += ' | LSH, Alm e Nível Alto no MES confirmados; entrada restaurada.'
        })
      })
    }
    etapa('Finalizar transferência após as validações')
    cy.then(() => {
      execucao.atual.inicioParada = Date.now()
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
        cy.env(['senhaMES'], { log: false }).then(({ senhaMES }) => {
          if (typeof senhaMES !== 'string' || !senhaMES.trim()) {
            throw new Error(opcoesExecucao.erroSenhaMes || 'Senha MES ausente. Confira o credenciais.local.json do projeto aberto no Cypress.')
          }
          cy.get('[name="loginModel.Password"]', { timeout: 30000 })
            .should('be.visible')
            .type(senhaMES, { log: false, parseSpecialCharSequences: false })
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
      }).then(() => verificarRecusaPartida(false)).then(() => {
        if (!falhou || !atual.inicioParada) return
        return cy.document({ log: false }).then(doc => {
          if (!confirmarVazio(doc, Cypress.dom.isVisible)) return
          atual.detalhes = [atual.detalhes, 'Encerramento confirmado por observação do MES após a falha do comando.'].filter(Boolean).join(' | ')
          if (!execucao.restauracaoFalhou) execucao.anterior = null
        })
      }).then(() => cy.task('registrarRev00', {
        pasta: execucao.pasta, data: new Date().toLocaleString('pt-BR'), ...atual.rota,
        resultado: falhou || execucao.restauracaoFalhou ? 'Falhou' : 'Concluída', etapa: atual.etapa,
        resultadoNormal: atual.nivelAltoExecutado ? (atual.normalConfirmado ? 'Concluída' : 'Falhou') : (falhou || execucao.restauracaoFalhou ? 'Falhou' : 'Concluída'),
        nivelAltoExecutado: atual.nivelAltoExecutado === true,
        resultadoNivelAlto: atual.nivelAltoExecutado ? (atual.nivelAlto?.ok && atual.restauracaoLSH?.ok ? 'Concluída' : 'Falhou') :
          (atual.rota.nivelAlto?.aplicavel === false ? 'Não aplicável' : null),
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
            solicitarParada: atual.tentouLimparInterrompida ? undefined : cartao => solicitarParada(cartao, cartao.botoes[0]),
          })
        }
      })
    })
    rotas.forEach((rota, indice) => {
      it(`${indice + 1}/${rotas.length} | ${rota.codigo} | ${rota.local} | ${rota.nome} | ${rota.origem} → ${rota.destino} | Rev 00`, function () {
        const divergencia = divergenciasNivel.get(JSON.stringify([rota.local, rota.destino]))
        if (divergencia) {
          const etapa = 'Rota adiada: ' + divergencia
          Cypress.log({ name: 'Destino adiado', message: etapa })
          return cy.task('registrarEtapa', { pasta: execucao.pasta, codigo: rota.codigo, etapa }, { log: false })
            .then(() => this.skip())
        }
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
