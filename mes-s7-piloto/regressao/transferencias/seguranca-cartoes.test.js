const { test } = require('node:test')
const assert = require('node:assert/strict')
const { avaliarCartoes, TransferenciaAtivaNaPreparacao } = require('../../testes/transferencias/seguranca-cartoes')
test('finalização de nível alto permite limpar cartão parado com situação, sem parar outra transferência', () => {
  const info = { vazio: false, cartoes: [{ nome: 'Transferência', quantidadeBotoes: 0, quantidadeLimpar: 1, quantidadeSituacoes: 1 }], nomePermitido: 'Transferência', nivelAltoConfirmado: true }
  assert.equal(avaliarCartoes(info), 'limpar')
  assert.throws(() => avaliarCartoes({ ...info, nivelAltoConfirmado: false }), /não identificado/)
  assert.throws(() => avaliarCartoes({ ...info, nomePermitido: 'Outra' }), /diferente/)
})

for (const exigeAtiva of [false, true]) test(`cartão encerrado com somente Limpar pode finalizar; exigeAtiva=${exigeAtiva}`, () => {
  const info = { vazio: false, cartoes: [{ nome: 'Transferência', quantidadeBotoes: 0, quantidadeLimpar: 1, quantidadeSituacoes: 0 }], nomePermitido: 'Transferência', exigeAtiva }
  assert.equal(avaliarCartoes(info), 'limpar')
  assert.equal(avaliarCartoes({ ...info, somenteLimpar: true }), 'limpar')
  const ativo = { ...info, cartoes: [{ ...info.cartoes[0], quantidadeBotoes: 1, quantidadeSituacoes: 1 }] }
  assert.equal(avaliarCartoes(ativo), 'parar')
  assert.throws(() => avaliarCartoes({ ...ativo, somenteLimpar: true }), erro => {
    assert.ok(erro instanceof TransferenciaAtivaNaPreparacao)
    assert.equal(erro.nomeCartao, 'Transferência')
    assert.match(erro.message, /não enviará Parar/)
    return true
  })
  assert.throws(() => avaliarCartoes({ ...ativo, nomePermitido: 'Outra', somenteLimpar: true }), /diferente/)
  assert.throws(() => avaliarCartoes({ ...info, nomePermitido: 'Outra' }), /diferente/)
  assert.throws(() => avaliarCartoes({ ...info, cartoes: [{ ...info.cartoes[0], quantidadeSituacoes: 1 }] }), /não identificado/)
  assert.throws(() => avaliarCartoes({ ...info, cartoes: [{ ...info.cartoes[0], quantidadeLimpar: 2 }] }), /não identificado/)
})

test('spec Cypress registra o primeiro local ativo e pula só as rotas do mesmo local', () => {
  const { readFileSync } = require('node:fs')
  const { join } = require('node:path')
  const { runInNewContext } = require('node:vm')
  const rotas = [
    { codigo: '179', local: 'Armazenagem', nome: 'Transferência', origem: 'RG37', destino: 'MG14' },
    { codigo: '178', local: 'Armazenagem', nome: 'Transferência', origem: 'RG37', destino: 'MG15' },
    { codigo: '704', local: 'Remoagem', nome: 'Outra transferência', origem: 'ME29', destino: 'ME07' },
  ]
  const testes = []
  const verificacoes = []
  const tarefas = []
  const cliques = []
  const mensagens = []
  let puladas = 0
  const cadeia = { then: () => cadeia, should: () => cadeia, click: () => cadeia }
  const cy = {
    then: () => cadeia,
    log: () => cadeia,
    get: () => cadeia,
    elementoMes: (_seletor, texto) => { cliques.push(texto); return cadeia },
    task: (nome, codigo) => { tarefas.push([nome, codigo]); return cadeia },
  }
  const aguardarEstadoTransferencias = () => ({ then: conferir => { verificacoes.push(conferir); return cadeia } })
  const modulos = {
    '../../comum/aguardar-transferencias': { aguardarEstadoTransferencias },
    '../../comum/impedimento-transferencia': require('../../comum/impedimento-transferencia'),
    '../../comum/visualizacao-monitor': { mostrarMonitor() {}, ocultarMonitor() {} },
    './recusa-partida': { tratarRecusaPartida: () => cadeia },
    './seguranca-cartoes': { avaliarCartoes, TransferenciaAtivaNaPreparacao },
  }
  const arquivo = join(__dirname, '../../testes/transferencias/rotas-transferencias.js')
  runInNewContext(readFileSync(arquivo, 'utf8'), {
    require: nome => modulos[nome] || {},
    describe: (...args) => args.at(-1)(),
    it: (nome, executar) => { if (/^\d+\//.test(nome)) testes.push(executar) },
    beforeEach() {},
    afterEach() {},
    cy,
    Cypress: {
      expose: nome => ({ pilotoS7: true, rotas })[nome],
      dom: { isVisible: () => true },
      log: ({ message }) => mensagens.push(message),
    },
  }, { filename: arquivo })

  testes[0]()
  assert.throws(() => verificacoes[0]({
    vazio: false,
    cartoes: [{ nome: 'Transferência', botoes: [{}], limpar: [], situacoes: 1, textosSituacoes: ['Iniciado'] }],
  }), /primeira rota bloqueada 179/)
  testes[1].call({ skip() { puladas++ } })
  assert.equal(puladas, 1)
  assert.match(mensagens[0], /Armazenagem.*Iniciado/)
  assert.equal(verificacoes.length, 1)
  assert.equal(cliques.includes('Parar'), false)
  testes[2]()
  assert.equal(verificacoes.length, 2)
  assert.deepEqual(tarefas.filter(([nome]) => nome === 'validarRotaLir').map(([, codigo]) => codigo), ['179', '704'])
})
