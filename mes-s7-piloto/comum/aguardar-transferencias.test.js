const { test } = require('node:test'), assert = require('node:assert/strict')
const { JSDOM } = require('jsdom'), { aguardarEstadoTransferencias } = require('./aguardar-transferencias')
const vazio = '<p>Não há nenhuma transferência em uso</p><input><button>Limpar</button>'
async function ensaio(frames, prazoMs = 1000) {
  const d = new JSDOM('<body></body>'); let tempo = 0, indice = 0, leituras = 0
  const cy = {
    document: () => { leituras++; d.window.document.body.innerHTML = frames[Math.min(indice++, frames.length - 1)]; return Promise.resolve(d.window.document) },
    wait: ms => { tempo += ms; return Promise.resolve() },
  }
  try { return { estado: await aguardarEstadoTransferencias({ cy, visivel: el => !el.closest('[hidden]'), agora: () => tempo, prazoMs }), tempo, leituras } } finally { d.window.close() }
}
test('mudança de aba: estado transitório não reprova rota antes de o MES renderizar vazio', async () => {
  const r = await ensaio(['<p>Carregando</p>', vazio, vazio])
  assert.equal(r.estado.vazio, true); assert.equal(r.leituras, 3); assert.equal(r.tempo, 400)
})
test('não decide pelo cartão da primeira renderização se a próxima mostra local vazio', async () => {
  const cartao = '<div class="row"><div><span>Nome</span><div>Outra</div></div><div class="card-situations">Iniciado</div><button>Parar</button></div>'
  const r = await ensaio([cartao, vazio, vazio]); assert.equal(r.estado.vazio, true)
})
test('estado realmente desconhecido expira com diagnóstico; não é ignorado', async () => {
  await assert.rejects(ensaio(['<p>Carregando</p>'], 400), /não estabilizou: mensagem vazia=false, cartões=0/)
})

test('cartão ativo em renderização aguarda o status real antes de permitir decisão', async () => {
  const card = '<div class="row"><div><span>Nome</span><div>Transferência Armazenagem</div></div><div class="card-situations">+</div><button>Parar</button></div>'
  const pronto = card.replace('>+</div>', '>Iniciado</div>')
  const r = await ensaio([card, card, pronto, pronto])
  assert.equal(r.estado.cartoes[0].situacoes, 1); assert.equal(r.leituras, 4)
})
