const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { cartoesOcupados, estadoDeRetomada, estadoDeEncerramento, lerCartao, normalizarStatus, botoesComTexto, botoesConfirmacao } = require('../../testes/recebimentos/cartao-recebimento')

const contexto = { ordem: '9390', rota: { destino: 'MG01' } }

test('expande somente a ordem 9390 e lê Nível Alto entre os estados adicionais', () => {
  const { document } = new JSDOM('<main><div class="row">9389 MG01 <span class="card-situations">Iniciado</span><button>+</button></div>' +
    '<div class="row">9390 MG01 <span class="card-situations">Aguardando Finalização</span><button><span>+</span></button>' +
    '<span class="card-situations" hidden>NÍVEL ALTO</span><span class="card-situations" hidden>Ocupado</span></div></main>').window
  const painel = document.querySelector('main')
  const visivel = el => !el.closest('[hidden]')
  const antes = lerCartao(painel, visivel, contexto)
  assert.deepEqual(antes.status, ['Aguardando Finalização'])
  assert.equal(antes.expandir, painel.querySelectorAll('button')[1])
  antes.expandir.addEventListener('click', () => {
    antes.expandir.textContent = '×'
    antes.cartoes[0].querySelectorAll('[hidden]').forEach(el => { el.hidden = false })
  })
  antes.expandir.click()
  const depois = lerCartao(painel, visivel, contexto)
  assert.equal(depois.expandir, null)
  assert.deepEqual(depois.status.map(normalizarStatus), ['aguardando finalizacao', 'nivel alto', 'ocupado'])
})

test('localiza o controle SVG sem texto apenas no cartão da ordem em teste', () => {
  const icone = '<span><div class="svgbtn-base"><div><svg></svg></div></div></span>'
  const { document } = new JSDOM('<main><div class="row">9389 MG01 <span class="card-situations">Iniciado</span>' + icone + '</div>' +
    '<div class="row">9390 MG01 <span class="card-situations">Aguardando Finalização</span>' + icone + '</div></main>').window
  const painel = document.querySelector('main')
  const resultado = lerCartao(painel, () => true, contexto)
  assert.equal(resultado.expandir, painel.querySelectorAll('span > .svgbtn-base > div')[1])
})

test('seleciona Parar no cartão correto e confirma somente o diálogo esperado', () => {
  const parar = 'Deseja realmente parar o recebimento Recebimento Grãos RG?'
  const finalizacao = 'A ordem de recebimento foi finalizada?'
  const { document } = new JSDOM('<main><div class="row">9389 MG01 <span class="card-situations">Iniciado</span><button>Parar</button></div>' +
    '<div class="row">9390 MG01 <span class="card-situations">Nível Alto</span><button id="parar">Parar</button></div></main>' +
    '<div role="dialog"><div class="modal-content"><p>' + parar + '</p><button id="confirmar-parada">Sim</button><button>Não</button></div></div>' +
    '<div role="dialog" hidden><p>' + finalizacao + '</p><button id="confirmar-finalizacao">Sim</button></div>' +
    '<div role="dialog"><p>Outro aviso</p><button>Sim</button></div>').window
  const visivel = el => !el.closest('[hidden]')
  const { cartoes } = lerCartao(document.querySelector('main'), visivel, contexto)
  assert.deepEqual(botoesComTexto(cartoes[0], 'Parar', visivel).map(el => el.id), ['parar'])
  const primeiro = botoesConfirmacao(document, parar, visivel)
  assert.deepEqual(primeiro.map(el => el.id), ['confirmar-parada'])
  assert.deepEqual(botoesConfirmacao(document, finalizacao, visivel), [])
  document.querySelector('[hidden]').hidden = false
  assert.deepEqual(botoesConfirmacao(document, finalizacao, visivel).map(el => el.id), ['confirmar-finalizacao'])
})

test('aceita painel livre após parada rápida e rejeita ausência sem confirmação do MES', () => {
  const { document } = new JSDOM('<main><div class="row">9390 MG01 <span class="card-situations">Parando</span></div></main>').window
  const painel = document.querySelector('main')
  const ler = () => estadoDeEncerramento(painel, () => true, contexto)
  assert.equal(ler(), 'parando')
  painel.innerHTML = ''
  assert.equal(ler(), null)
  painel.innerHTML = '<p>Não há nenhum recebimento em uso</p>'
  assert.equal(ler(), 'livre')
  painel.insertAdjacentHTML('beforeend', '<div class="row">9389 MG01 <span class="card-situations">Iniciado</span></div>')
  assert.equal(ler(), null)
})

test('retoma só a OR atual e escolhe Não no diálogo de finalização', () => {
  const { document } = new JSDOM('<main><div class="row">9390 MG01 <span class="card-situations">Interrompido</span></div></main>' +
    '<div role="dialog"><p>A ordem de recebimento foi finalizada?</p><button>Sim</button><button>Não</button></div>').window
  const painel = document.querySelector('main')
  const visivel = () => true
  const ler = () => estadoDeRetomada(painel, visivel, contexto)
  assert.equal(ler(), 'recuperar')
  assert.equal(botoesConfirmacao(document, 'A ordem de recebimento foi finalizada?', visivel, 'Não')[0].textContent, 'Não')
  painel.querySelector('.card-situations').textContent = 'Parando'
  assert.equal(ler(), 'parando')
  painel.insertAdjacentHTML('beforeend', '<div class="row">9389 MG01 <span class="card-situations">Iniciado</span></div>')
  assert.equal(ler(), 'bloqueado')
  painel.replaceChildren()
  assert.equal(ler(), 'aguardando')
})

test('detecta ordem ocupada mesmo com os estados recolhidos', () => {
  const { document } = new JSDOM('<main><div class="row"><div><b>O. R.</b><span>9406</span></div>' +
    '<div><b>Destino Atual</b><span>NC04</span></div><div><b>Situação</b><button>+</button>' +
    '<span class="card-situations" hidden>Ocupado</span></div></div></main>').window
  const painel = document.querySelector('main')
  const visivel = el => !el.closest('[hidden]')
  assert.deepEqual(cartoesOcupados(painel, visivel), [{ ordem: '9406', destino: 'NC04' }])
  assert.equal(estadoDeRetomada(painel, visivel, contexto), 'bloqueado')
})
