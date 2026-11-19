const { test } = require('node:test'), assert = require('node:assert/strict')
const { JSDOM } = require('jsdom'), { recuperarEncerramento } = require('./recuperar-encerramento')
const ativo = '<div class="row"><div><span>Nome</span><div>Transferência Armazenagem</div></div><div class="card-situations">Iniciado</div><button>Parar</button></div>'
const vazio = '<p>Não há nenhuma transferência em uso</p>'
async function ensaio({ encerra = true, restauracaoFalhou = false }) {
  const dom = new JSDOM('<body>'+ativo+'</body>'); let tempo = 0, esperas = 0
  const atual = { tentouParar: true, rota: { codigo: '169', nome: 'Transferência Armazenagem' } }
  const execucao = { anterior: { nome: atual.rota.nome }, pasta: 'lote', restauracaoFalhou }; const etapas = []
  const cy = {
    document: () => Promise.resolve(dom.window.document),
    wait: ms => { tempo += ms; esperas++; if (encerra) dom.window.document.body.innerHTML = vazio; return Promise.resolve() },
    task: (nome, dados) => { assert.equal(nome, 'registrarEtapa'); etapas.push(dados.etapa); return Promise.resolve() },
    log: () => Promise.resolve(),
    // Não há click, type, escrita ou comando Parar no adaptador.
  }
  try { const estado = await recuperarEncerramento({ cy, execucao, atual, visivel: () => true, agora: () => tempo, prazoMs: 1000 }); return { estado, execucao, esperas, etapas } } finally { dom.window.close() }
}
test('falha após tentar Parar: cartão some, vazio confirma e libera a próxima rota', async () => {
  const r = await ensaio({})
  assert.equal(r.estado.livre, true); assert.equal(r.execucao.anterior, null); assert.equal(r.esperas, 1); assert.equal(r.etapas.length, 1)
})
test('cartão ativo até o prazo mantém bloqueio sem lançar erro do hook nem repetir parada', async () => {
  const r = await ensaio({ encerra: false })
  assert.equal(r.estado.livre, false); assert.ok(r.execucao.anterior); assert.equal(r.esperas, 2)
})
test('mesmo local vazio não libera execução com restauração de LSH pendente', async () => {
  const r = await ensaio({ restauracaoFalhou: true })
  assert.equal(r.estado.livre, true); assert.ok(r.execucao.anterior); assert.equal(r.execucao.restauracaoFalhou, true)
})
