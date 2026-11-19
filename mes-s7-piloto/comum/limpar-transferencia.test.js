const { test } = require('node:test'), assert = require('node:assert/strict')
const { JSDOM } = require('jsdom'), { limparTransferencia } = require('./limpar-transferencia'), { lerCartoes } = require('./cartoes-mes')
const visivel = el => !el.closest('[hidden]')
const card = '<div class="row"><div><span>Local Transferência</span><div>Transferência Armazenagem</div></div><div class="card-situations">+</div><button>Limpar</button></div>'
async function ensaio({ conclui = true, nome = 'Transferência Armazenagem' } = {}) {
  const d = new JSDOM('<body>'+card+'</body>'), doc = d.window.document, eventos = []
  const cy = {
    elementoMes(_, texto, opcoes) { return { click() {
      if (texto === 'Limpar') {
        const cards = lerCartoes(doc, visivel, opcoes.cartao)
        assert.equal(cards.length, 1, 'cartão esperado precisa existir'); assert.equal(cards[0].limpar.length, 1)
        eventos.push(texto)
        doc.body.insertAdjacentHTML('beforeend', '<section role="dialog"><p>Deseja realmente limpar a transferência</p><button>Sim</button></section>')
      } else {
        assert.equal(texto, 'Sim'); assert.ok(doc.querySelector('[role=dialog]')); eventos.push(texto)
        doc.querySelector('[role=dialog]').remove()
        if (conclui) doc.body.innerHTML = '<p>Não há nenhuma transferência em uso</p><input><button>Limpar</button>'
      }
      return Promise.resolve()
    } } },
    contains(texto) { return { should() { assert.ok(doc.body.textContent.includes(texto)); eventos.push('confirmacao'); return Promise.resolve() } } },
    get() { return { should(fn) { fn([{ ownerDocument: doc }]); eventos.push('vazio'); return Promise.resolve() } } },
  }
  try { await limparTransferencia({ cy, nome, visivel }); return eventos } finally { d.window.close() }
}
test('cartão do print: Limpar, confirmação Sim, ausência de transferência; sem Parar', async () => {
  assert.deepEqual(await ensaio(), ['Limpar', 'confirmacao', 'Sim', 'vazio'])
})
test('não considera limpeza concluída se o cartão permanecer no MES', async () => {
  await assert.rejects(ensaio({ conclui: false }), /encerramento.*não foi confirmado/)
})
test('não limpa cartão de outro nome', async () => {
  await assert.rejects(ensaio({ nome: 'Outra' }), /cartão esperado/)
})
