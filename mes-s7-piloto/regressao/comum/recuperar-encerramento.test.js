const { test } = require('node:test'), assert = require('node:assert/strict')
const { JSDOM } = require('jsdom'), { recuperarEncerramento } = require('../../comum/recuperar-encerramento')
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

async function recuperarAposFalha({ alterarTela, confirmouIniciado = true, tentouParar = false,
  restauracaoFalhou = false, encerra = true } = {}) {
  const dom = new JSDOM('<body>' + ativo + '</body>')
  const { document } = dom.window
  let tempo = 0
  const atual = {
    tentouParar,
    cartaoIniciado: confirmouIniciado ? document.querySelector('.row') : undefined,
    rota: { codigo: '179', nome: 'Transferência Armazenagem' },
  }
  const execucao = { anterior: { nome: atual.rota.nome }, pasta: 'lote', restauracaoFalhou }
  const comandos = []
  alterarTela?.(document)
  const cy = {
    document: () => Promise.resolve(document),
    wait: ms => { tempo += ms; return Promise.resolve() },
    task: (nome, dados) => { assert.equal(nome, 'registrarEtapa'); comandos.push(dados.etapa); return Promise.resolve() },
    log: () => Promise.resolve(),
  }
  const solicitarParada = async cartao => {
    assert.equal(atual.tentouParar, true, 'marca a tentativa antes do comando')
    assert.equal(cartao.linha, atual.cartaoIniciado)
    comandos.push('Parar', 'Sim')
    if (encerra) document.body.innerHTML = vazio
  }
  try {
    const estado = await recuperarEncerramento({
      cy, execucao, atual, visivel: () => true, solicitarParada, agora: () => tempo, prazoMs: 1000,
    })
    return { estado, execucao, comandos }
  } finally { dom.window.close() }
}

test('falha após Iniciado, antes de Parar: encerra o cartão do teste e libera o lote', async () => {
  const r = await recuperarAposFalha()
  assert.deepEqual(r.comandos, ['Parar', 'Sim', 'Parada de recuperação confirmada no MES após a falha.'])
  assert.equal(r.estado.livre, true)
  assert.equal(r.execucao.anterior, null)
})

test('parada de recuperação sem confirmação não reenvia comando e mantém o bloqueio', async () => {
  const r = await recuperarAposFalha({ encerra: false })
  assert.deepEqual(r.comandos.slice(0, 2), ['Parar', 'Sim'])
  assert.equal(r.comandos.length, 3)
  assert.equal(r.estado.livre, false)
  assert.ok(r.execucao.anterior)
})

for (const [cenario, opcoes] of [
  ['a parada já foi tentada', { tentouParar: true }],
  ['não houve confirmação de Iniciado', { confirmouIniciado: false }],
  ['a restauração da LSH falhou', { restauracaoFalhou: true }],
  ['o cartão foi substituído por outro de mesmo nome', { alterarTela: d => { d.body.innerHTML = ativo } }],
  ['o nome mudou na mesma linha', { alterarTela: d => { d.querySelector('.row > div > div').textContent = 'Outra transferência' } }],
  ['o cartão saiu de Iniciado', { alterarTela: d => { d.querySelector('.card-situations').textContent = 'Parado' } }],
  ['há dois cartões', { alterarTela: d => { d.body.insertAdjacentHTML('beforeend', ativo) } }],
  ['há uma confirmação aberta', { alterarTela: d => { d.body.insertAdjacentHTML('beforeend', '<div role="dialog"><button>Sim</button></div>') } }],
  ['Parar está desabilitado', { alterarTela: d => { d.querySelector('button').disabled = true } }],
]) {
  test('mantém o bloqueio sem enviar Parar quando ' + cenario, async () => {
    const r = await recuperarAposFalha(opcoes)
    assert.equal(r.comandos.length, 1)
    assert.equal(r.estado.livre, false)
    assert.ok(r.execucao.anterior)
  })
}

test('local já vazio após falha libera o lote sem enviar Parar', async () => {
  const r = await recuperarAposFalha({ alterarTela: d => { d.body.innerHTML = vazio } })
  assert.equal(r.comandos.length, 1)
  assert.equal(r.estado.livre, true)
  assert.equal(r.execucao.anterior, null)
})
