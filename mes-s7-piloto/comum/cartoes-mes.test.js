const { test } = require('node:test'), assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const { lerCartoes, confirmarVazio, estadoRecuperacao } = require('./cartoes-mes')
const visivel = el => !el.closest('[hidden]')
const cartao = (nome = 'Transferência Armazenagem') => `<div class="row"><div><span>Nome</span><div>${nome}</div></div><div class="card-situations">Iniciado</div><button>Parar</button></div>`
function dom(html) { return new JSDOM('<body>' + html + '</body>') }
test('ignora nome do formulário/cabeçalho e encontra apenas o cartão com comandos', () => {
  const d = dom('<div class="row"><div><span>Nome</span><div>Transferência Armazenagem</div></div></div>' + cartao())
  try { assert.equal(lerCartoes(d.window.document, visivel, 'Transferência Armazenagem').length, 1) } finally { d.window.close() }
})
test('reconhece nome em outra posição da row e continua exigindo identificação única', () => {
  const d = dom('<div class="row"><header>Transferência Armazenagem</header><div class="card-situations">Iniciado</div><button>Parar</button></div>')
  try { assert.equal(lerCartoes(d.window.document, visivel, 'Transferência Armazenagem').length, 1) } finally { d.window.close() }
})
test('cartão desapareceu após tentativa de parada: local vazio libera recuperação sem novo comando', () => {
  const d = dom(cartao())
  try {
    assert.equal(estadoRecuperacao(d.window.document, visivel, 'Transferência Armazenagem').livre, false)
    d.window.document.body.innerHTML = '<p>Não há nenhuma transferência em uso</p>'
    assert.equal(estadoRecuperacao(d.window.document, visivel, 'Transferência Armazenagem').livre, true)
    assert.equal(d.window.document.querySelectorAll('button').length, 0)
  } finally { d.window.close() }
})
test('não libera por mensagem vazia residual, cartão de outra transferência, duplicidade ou DOM desconhecido', () => {
  for (const html of ['<p>Não há nenhuma transferência em uso</p>'+cartao('Outra'), cartao()+cartao(), '<p>Carregando</p>', '<p>Não há nenhuma transferência em uso</p><button>Sim</button>', '<p>Não há nenhuma transferência em uso</p><section><button>Parar</button></section>']) {
    const d = dom(html)
    try { assert.equal(confirmarVazio(d.window.document, visivel), false); assert.equal(estadoRecuperacao(d.window.document, visivel, 'Transferência Armazenagem').livre, false) } finally { d.window.close() }
  }
})
test('consulta Cypress usa DOM atualizado: zero retorna vazio, reaparecimento encontra e dois cartões falham', () => {
  const d = dom('<p>Não há nenhuma transferência em uso</p>')
  // Adaptador mínimo de coleção: a consulta real roda sobre o documento JSDOM.
  const $ = valor => {
    const elementos = Array.isArray(valor) ? valor : [valor]
    return { length: elementos.length,
      find: seletor => $(elementos.flatMap(el => [...el.querySelectorAll(seletor)])),
      filter: fn => $(elementos.filter((el, i) => fn(i, el))),
    }
  }
  let query
  try {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'consultas-mes.js'), 'utf8'), { require: id => require(id), Cypress: { Commands: { addQuery: (_, f) => { query = f } }, $, dom: { isVisible: visivel } }, cy: { state: () => d.window.document } })
    const buscar = query.call({ set() {} }, 'button', 'Parar', { cartao: 'Transferência Armazenagem' })
    assert.equal(buscar().length, 0)
    d.window.document.body.innerHTML = cartao()
    assert.equal(buscar().length, 1)
    d.window.document.body.insertAdjacentHTML('beforeend', cartao())
    assert.throws(buscar, /Mais de um cartão real/)
  } finally { d.window.close() }
})

test('clone oculto de cartão não torna a seleção ambígua', () => {
  const d = dom(cartao() + '<section hidden>' + cartao() + '</section>')
  try { assert.equal(lerCartoes(d.window.document, visivel, 'Transferência Armazenagem').length, 1) } finally { d.window.close() }
})

test('regressão 11.1: Limpar do formulário não invalida a mensagem de nenhuma transferência em uso', () => {
  const d = dom('<div class="row"><div><label>Transferência</label><div class="custom-dropdown"><div class="form-select">Transferência Líquidos</div></div></div><input placeholder="Buscar..."><button>Limpar</button></div><p>Não há nenhuma transferência em uso</p>')
  try { assert.equal(lerCartoes(d.window.document, visivel).length, 0); assert.equal(confirmarVazio(d.window.document, visivel), true) } finally { d.window.close() }
})
test('não associa um cabeçalho a comandos de outra row ancestral', () => {
  const d = dom('<div class="row"><div class="row"><div><span>Nome</span><div>Transferência Armazenagem</div></div></div><div><input><button>Limpar</button></div></div><p>Não há nenhuma transferência em uso</p>')
  try { assert.equal(lerCartoes(d.window.document, visivel).length, 0); assert.equal(confirmarVazio(d.window.document, visivel), true) } finally { d.window.close() }
})
test('cartão real com somente Limpar continua impedindo a declaração de local vazio', () => {
  const d = dom(cartao().replace('<div class="card-situations">Iniciado</div>', '').replace('Parar', 'Limpar')+'<p>Não há nenhuma transferência em uso</p>')
  try { assert.equal(lerCartoes(d.window.document, visivel).length, 1); assert.equal(confirmarVazio(d.window.document, visivel), false) } finally { d.window.close() }
})

for (const placeholder of ['', '+', '<span class="material-icons">add</span>']) test('situação sem estado real não é contada como ativa: ' + placeholder, () => {
  const d = dom(cartao().replace('Iniciado', placeholder).replace('Parar', 'Limpar'))
  try {
    const cards = lerCartoes(d.window.document, visivel)
    assert.equal(cards.length, 1); assert.equal(cards[0].situacoes, 0); assert.equal(cards[0].limpar.length, 1)
    assert.equal(confirmarVazio(d.window.document, visivel), false, 'o cartão ainda precisa ser limpo')
  } finally { d.window.close() }
})
