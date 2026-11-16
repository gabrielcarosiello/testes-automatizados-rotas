/* Versão inicial: uma rota por teste. Mantenha a VM e o supervisório visíveis. */
describe('Transferir Granel - Rev 00', { testIsolation: false }, () => {
  const { avaliarCartoes } = require('./seguranca-cartoes')
  const rotas = Cypress.expose('rotas')
  const campo = {
    transferencia: ':nth-child(1) > .custom-dropdown > .form-select',
    origem: ':nth-child(2) > .custom-dropdown > .form-select',
    destino: ':nth-child(3) > .custom-dropdown > .form-select',
    rota: '[style="width: 31rem"] > .custom-dropdown > .form-select'
  }
  const execucao = { pronta: false, login: false, pasta: '', atual: null, anterior: null, inicioExecucao: null, inicioLogin: null, loginSeg: '', cardSeg: '', campoSeg: '' }
  const busca = 'input[placeholder="Buscar..."]:visible:enabled'

  function etapa(nome) { return cy.then(() => { execucao.atual.etapa = nome }) }
  function segundos(inicio) { return ((Date.now() - inicio) / 1000).toFixed(2) }
  function nomeSeguro(valor, limite = 60) { return valor.replace(/->/g, '-').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, limite) }
  function capturar(sufixo) {
    return cy.then(() => {
      const r = execucao.atual.rota
      const data = new Date().toISOString().replace(/[:.]/g, '-')
      return cy.task('capturarTelas', { nome: `${nomeSeguro(r.codigo, 12)}-${nomeSeguro(r.local, 20)}-${nomeSeguro(r.nome, 20)}-${nomeSeguro(r.rota)}-${sufixo}-${data}`, pastaExecucao: execucao.pasta })
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
        if (opcoes.length > 1) throw new Error(`Mais de uma opção exata encontrada para ${valor}`)
        if (opcoes.length === 1) return cy.wrap(opcoes).click().then(() => 'encontrada')
        const vazio = painel.find(':visible').filter((_, el) => el.textContent.trim() === 'Nenhum item encontrado.')
        if (vazio.length) return 'vazia'
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
      return cy.get(seletor, { timeout: 30000 }).should('have.length', 1)
        .should('be.visible').and('be.enabled').then($entrada => {
          if (!$entrada.val()) return
          return cy.get(seletor, { timeout: 30000 }).should('have.length', 1)
            .should('be.enabled').type('{selectall}')
        }).then(() => cy.get(seletor, { timeout: 30000 }).should('have.length', 1)
          .should('be.visible').and('be.enabled').type(valor, { parseSpecialCharSequences: false }))
    })
    cy.wait(1000)
    return cy.then(() => aguardarResultado(valor, Date.now() + 8000)).then(resultado => {
      if (resultado === 'encontrada') return
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
    // Compara o texto da aba ignorando apenas acentos, espaços e maiúsculas.
    const normalizar = texto => texto.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    const iguais = $abas => $abas.filter((_, aba) =>
      Cypress.dom.isVisible(aba) && normalizar(aba.textContent || '') === normalizar(local)
    )
    cy.get('.dxbl-tabs-text-container > .dxbl-text', {
      timeout: 10000,
      includeShadowDom: true
    })
      .should($abas => {
        expect(iguais($abas), `aba única do local ${local}`).to.have.length(1)
      })
      .then($abas => cy.wrap(iguais($abas)).should('be.visible').click())
  }
  // Na preparação, aceita parar o único cartão reconhecido do local.
  // Na parada normal, exige o nome da transferência iniciada pelo teste.
  function verificarEParar(nomePermitido = null, exigeAtiva = false) {
    return cy.get('body').then($body => {
      const vazio = $body.find(':visible').filter((_, el) =>
        el.textContent.trim() === 'Não há nenhuma transferência em uso'
      ).length > 0
      const cartoes = []
      $body.find('.row > :nth-child(1) > :nth-child(2):visible').each((_, el) => {
        const linha = Cypress.$(el).closest('.row')
        const situacoes = linha.find('.card-situations')
        const botoes = linha.find('button:visible').filter((__, botao) => botao.textContent.trim() === 'Parar')
        const limpar = linha.find('button:visible').filter((__, botao) => botao.textContent.trim() === 'Limpar')
        if (!situacoes.length && !botoes.length && !limpar.length) return
        cartoes.push({ nome: el.textContent.trim(), botoes, limpar, situacoes: situacoes.length })
      })
      const decisao = avaliarCartoes({
        vazio,
        cartoes: cartoes.map(c => ({ nome: c.nome, quantidadeBotoes: c.botoes.length,
          quantidadeLimpar: c.limpar.length, quantidadeSituacoes: c.situacoes })),
        nomePermitido, exigeAtiva
      })
      if (decisao === 'vazio') return
      const cartao = cartoes[0]
      if (decisao === 'limpar') {
        execucao.atual.detalhes = [execucao.atual.detalhes, 'Cartão sem situação: tentativa de limpeza: ' + cartao.nome].filter(Boolean).join(' | ')
        return cy.wrap(cartao.limpar).should('be.enabled').click().then(() =>
          cy.contains('Deseja realmente limpar a transferência', { timeout: 30000 }).should('be.visible')
        ).then(() => cy.contains('button', /^\s*Sim\s*$/, { timeout: 30000 })
          .should('be.visible').and('be.enabled').click()
        ).then(() => cy.contains('Não há nenhuma transferência em uso', { timeout: 30000 }).should('be.visible')
        ).then(() => {
          execucao.atual.detalhes = [execucao.atual.detalhes, 'Limpeza confirmada: ' + cartao.nome].filter(Boolean).join(' | ')
        })
      }
      execucao.atual.detalhes = [execucao.atual.detalhes, 'Tentativa de parar transferência: ' + cartao.nome].filter(Boolean).join(' | ')
      return cy.wrap(cartao.botoes).should('be.enabled').click().then(() =>
        cy.contains('button', /^\s*Sim\s*$/, { timeout: 30000 }).should('be.visible').and('be.enabled').click()
      ).then(() => cy.contains('Não há nenhuma transferência em uso', { timeout: 30000 }).should('be.visible')).then(() => {
        execucao.atual.detalhes = [execucao.atual.detalhes, 'Parada confirmada: ' + cartao.nome].filter(Boolean).join(' | ')
      })
    })
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
    verificarEParar()
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
        cy.wrap(botoes).should('be.enabled').click()
        return
      }
      if (botoes.length > 1 || tentativa) throw new Error('Botão Iniciar ausente ou ambíguo após limpeza')
      execucao.atual.detalhes = 'Botão Iniciar ausente; formulário limpo e rota preparada novamente'
      cy.contains('Não há nenhuma transferência em uso', { timeout: 30000 }).should('be.visible')
      cy.contains('button', /^\s*Limpar\s*$/, { timeout: 30000 }).should('be.visible').and('be.enabled').click()
      cy.get(campo.transferencia).should('not.contain.text', rota.nome)
      preparar(rota)
      return iniciar(rota, 1)
    })
  }
  function testar(rota) {
    preparar(rota)
    iniciar(rota)
    etapa('Aguardar iniciado')
    cy.then(() => { execucao.atual.inicioStatus = Date.now() })
    cy.get('body', { timeout: 100000 }).should($body => {
      const nomes = $body.find('.row > :nth-child(1) > :nth-child(2):visible').filter((_, el) => el.textContent.trim() === rota.nome)
      expect(nomes, 'cartão da transferência').to.have.length(1)
      const situacoes = nomes.eq(0).closest('.row').find('.card-situations:visible').filter((_, el) => el.textContent.trim() === 'Iniciado')
      expect(situacoes, 'situação da transferência').to.have.length(1)
    })
    cy.then(() => { execucao.atual.inicio = segundos(execucao.atual.inicioStatus) })
    cy.wait(5000)
    etapa('Capturar supervisório')
    capturar('iniciado')
    etapa('Parar transferência')
    cy.then(() => { execucao.atual.inicioParada = Date.now() })
    verificarEParar(rota.nome, true)
    cy.then(() => { execucao.atual.parada = segundos(execucao.atual.inicioParada); execucao.anterior = null })
  }

  it('01 - Login - Rev 00', () => {
    cy.pause()
    cy.then(() => { execucao.inicioExecucao = Date.now(); execucao.inicioLogin = Date.now() })
    cy.visit('http://localhost/nexxus-mes')
    // Aguarda a aplicação identificar se já existe uma sessão.
    cy.location('pathname', { timeout: 30000 })
      .should('match', /\/(login|home)\/?$/i)
      .then((caminho) => {
        if (/\/home\/?$/i.test(caminho)) return

        cy.get('.form-select', { timeout: 30000 }).should('be.visible').click()
        cy.get('[title="ADMIN"]', { timeout: 30000 }).should('be.visible').click()
        cy.env(['senhaMES']).then(({ senhaMES }) => {
          if (!senhaMES) throw new Error('Senha ausente: configure credenciais.local.json')
          cy.get('[name="loginModel.Password"]', { timeout: 30000 })
            .should('be.visible')
            .type(senhaMES, { log: false })
        })
        cy.get('.btn', { timeout: 30000 }).should('be.enabled').click()
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
    cy.wait(3000)
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
      if (!execucao.pronta) this.skip()
      execucao.atual = null
      // Observa o formulário; o tratamento do botão ocorre após selecionar a rota.
      cy.get('body').then($body => {
        const iniciar = $body.find('button:visible').filter((_, el) => el.textContent.trim() === 'Iniciar')
        cy.log(`Preparação: ${iniciar.length} botão(ões) Iniciar visível(is)`)
      })
    })
    afterEach(function () {
      if (!execucao.atual || !execucao.pasta) return
      const atual = execucao.atual
      const falhou = this.currentTest.state === 'failed'
      const erro = this.currentTest.err && this.currentTest.err.message
      return cy.task('registrarRev00', {
        pasta: execucao.pasta, data: new Date().toLocaleString('pt-BR'), ...atual.rota,
        resultado: falhou ? 'Falhou' : 'Concluída', etapa: atual.etapa,
        detalhes: [atual.detalhes, erro].filter(Boolean).join(' | '),
        loginSeg: execucao.loginSeg, cardSeg: execucao.cardSeg, campoSeg: execucao.campoSeg,
        inicio: atual.inicio, parada: atual.parada,
        total: atual.inicioRota ? segundos(atual.inicioRota) : '',
        rotaCompleta: atual.inicioTeste ? segundos(atual.inicioTeste) : '',
        execucaoAteAgora: execucao.inicioExecucao ? segundos(execucao.inicioExecucao) : '', captura: atual.captura
      }).then(resultado => {
        if (resultado && resultado.aviso) cy.log('AVISO AO REGISTRAR RESULTADO: ' + resultado.aviso)
      })
    })
    rotas.forEach((rota, indice) => {
      it(`${indice + 1}/${rotas.length} | ${rota.codigo} | ${rota.local} | ${rota.nome} | ${rota.origem} → ${rota.destino} | Rev 00`, () => {
        execucao.atual = { rota, etapa: 'Preparação', detalhes: '', captura: '', inicioTeste: Date.now() }
        testar(rota)
      })
    })
  })
})
