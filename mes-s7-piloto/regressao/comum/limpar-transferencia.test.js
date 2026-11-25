const { test } = require('node:test'), assert = require('node:assert/strict')
const { JSDOM } = require('jsdom'), { limparTransferencia, aguardarEncerramento } = require('../../comum/limpar-transferencia')
const { lerCartoes } = require('../../comum/cartoes-mes')
const visivel = el => !el.closest('[hidden]')
const card = '<div class="row"><div><span>Nome</span><div>Transferência Armazenagem</div></div><div class="card-situations">+</div><button>Limpar</button></div>'
const vazio = '<p>Não há nenhuma transferência em uso</p>'

async function ensaio({ conclui = true, confirmacao = true, nome = 'Transferência Armazenagem' } = {}) {
  const dom = new JSDOM('<body>'+card+'</body>'), doc = dom.window.document, eventos = []
  let tempo = 0
  const cy = {
    elementoMes(_, texto, opcoes) { return { click: async () => {
      assert.equal(texto, 'Limpar')
      assert.equal(lerCartoes(doc, visivel, opcoes.cartao).length, 1, 'cartão esperado precisa existir')
      eventos.push(texto)
      if (confirmacao) doc.body.insertAdjacentHTML('beforeend', '<section role="dialog"><p>Deseja realmente limpar a transferência</p><button>Sim</button></section>')
      else doc.body.innerHTML = vazio
    } } },
    wrap: botao => ({ click: async () => {
      assert.equal(botao.textContent, 'Sim')
      eventos.push('Sim')
      botao.closest('[role=dialog]').remove()
      if (conclui) doc.body.innerHTML = vazio
    } }),
    document: async () => doc,
    wait: async ms => { tempo += ms },
  }
  try {
    const resultado = await limparTransferencia({ cy, nome, visivel, prazoMs: 1000, agora: () => tempo })
    return { eventos, resultado }
  } finally { dom.window.close() }
}

test('limpa cartão, confirma Sim do próprio diálogo e verifica local vazio', async () => {
  assert.deepEqual(await ensaio(), { eventos: ['Limpar', 'Sim'], resultado: { confirmou: true } })
})

test('local vazio antes da exibição do diálogo encerra sem esperar ou repetir Limpar', async () => {
  assert.deepEqual(await ensaio({ confirmacao: false }), { eventos: ['Limpar'], resultado: { confirmou: false } })
})

test('mantém falha quando cartão permanece após Sim', async () => {
  await assert.rejects(ensaio({ conclui: false }), /Encerramento não confirmado/)
})

test('não limpa cartão de outro nome', async () => {
  await assert.rejects(ensaio({ nome: 'Outra' }), /cartão esperado/)
})

test('outro diálogo Sim não confirma a parada', async () => {
  const d = new JSDOM('<section role="dialog"><p>Deseja realmente limpar a transferência?</p><button>Sim</button></section>')
  try {
    const cy = { document: async () => d.window.document, wrap: () => assert.fail('outra ação') }
    await assert.rejects(aguardarEncerramento({ cy, acao: 'parar', visivel, prazoMs: 0 }), /Encerramento não confirmado/)
  } finally { d.window.close() }
})
