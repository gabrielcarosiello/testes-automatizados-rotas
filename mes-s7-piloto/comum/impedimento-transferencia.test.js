'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { diagnosticarLocal } = require('./cartoes-mes')
const { identificarTransferenciaInterrompida, diagnosticarELimparInterrompida } = require('./impedimento-transferencia')

const rota = { codigo: '704', nome: 'Transferência Remoagem Extrusão EX', local: 'Remoagem', origem: 'ME29', destino: 'ME07' }
const visivel = el => !el.closest('[hidden]')
const cartao = '<div class="row"><div><span>Local Transferência</span><div>' + rota.nome +
  '</div></div>\nTransferência\n12127\nOrigem / Destino Atual\nME29 -> ME07\n<div class="card-situations">Interrompido</div>' +
  '<button disabled>Parar</button><button>Limpar</button><button>Mais Informações</button></div>'

function fixture({ aoRegistrar, conclui = true } = {}) {
  const dom = new JSDOM('<body>' + cartao + '</body>')
  const doc = dom.window.document
  const eventos = []
  const atual = { rota, s7: { tags: [{ label: 'ME32', good: true, value: false }] } }
  const execucao = { pasta: 'lote', anterior: { nome: rota.nome } }
  const cy = {
    document: () => Promise.resolve(doc),
    wrap: botao => ({ click: async () => {
      const nome = botao.textContent
      eventos.push(nome)
      if (nome === 'Mais Informações') doc.body.insertAdjacentHTML('beforeend', '<section role="dialog"><table><tr><td>ME06</td><td>Emergência</td></tr><tr><td>ME32</td><td>Normal</td></tr><tr><td>ME29</td><td>Sem emergência</td></tr></table><button>Fechar</button></section>')
      if (nome === 'Fechar') botao.closest('[role=dialog]').remove()
      if (nome === 'Limpar') doc.body.insertAdjacentHTML('beforeend', '<section role="dialog"><p>Deseja realmente limpar a transferência</p><button>Sim</button></section>')
    } }),
    elementoMes: (_, nome) => ({ click: async () => {
      assert.equal(nome, 'Sim')
      eventos.push(nome)
      doc.querySelector('[role=dialog]').remove()
      if (conclui) doc.body.innerHTML = '<p>Não há nenhuma transferência em uso</p>'
    } }),
    contains: texto => ({ should: async () => { assert.ok(doc.body.textContent.includes(texto)) } }),
    get: () => ({ should: fn => { fn([doc.body]); return Promise.resolve() } }),
    task: async (tarefa, dados) => {
      assert.equal(tarefa, 'registrarEtapa')
      assert.match(dados.etapa, /12127.*ME06.*Emergência/)
      eventos.push('registro')
      aoRegistrar?.(doc)
    },
  }
  const identificar = (r = rota) => identificarTransferenciaInterrompida(diagnosticarLocal(doc, visivel), r)
  return {
    doc, atual, execucao, eventos, identificar, fechar: () => dom.window.close(),
    executar: () => diagnosticarELimparInterrompida({ cy, execucao, atual, identificada: identificar(), visivel }),
  }
}

test('registra situação do MES e retorno S7, limpa o cartão interrompido e mantém a falha da rota', async () => {
  const f = fixture()
  try {
    await assert.rejects(f.executar(), /local liberado/i)
    assert.deepEqual(f.eventos, ['Mais Informações', 'Fechar', 'registro', 'Limpar', 'Sim'])
    assert.match(f.atual.detalhes, /ME06 · Emergência/)
    assert.match(f.atual.detalhes, /ME32 \(retorno não confirmado\)/)
    assert.doesNotMatch(f.atual.detalhes, /ME32 · Normal|ME29 · Sem emergência/)
    assert.match(f.atual.detalhes, /Limpeza confirmada/)
    assert.equal(f.execucao.anterior, null)
  } finally { f.fechar() }
})

test('cartão trocado após o diagnóstico não recebe Limpar', async () => {
  const f = fixture({ aoRegistrar: doc => { doc.body.innerHTML = cartao.replace('12127', '12128') } })
  try {
    await assert.rejects(f.executar(), /mudou antes/)
    assert.deepEqual(f.eventos, ['Mais Informações', 'Fechar', 'registro'])
    assert.ok(f.execucao.anterior)
  } finally { f.fechar() }
})

test('sem confirmação de local vazio conserva o bloqueio', async () => {
  const f = fixture({ conclui: false })
  try {
    await assert.rejects(f.executar(), /encerramento.*não foi confirmado/)
    assert.ok(f.execucao.anterior)
  } finally { f.fechar() }
})

test('limpeza exige origem e destino corretos, situação interrompida e botão habilitado', () => {
  const f = fixture()
  try {
    assert.equal(f.identificar().id, '12127')
    assert.equal(f.identificar({ ...rota, origem: 'ME01' }), null)
    f.doc.querySelector('.card-situations').textContent = 'Iniciado'
    assert.equal(f.identificar(), null)
    f.doc.querySelector('.card-situations').textContent = 'Interrompido'
    f.doc.querySelector('button').disabled = false
    assert.equal(f.identificar(), null)
  } finally { f.fechar() }
})
