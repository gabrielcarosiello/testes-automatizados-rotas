'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { diagnosticarLocal } = require('../../comum/cartoes-mes')
const { identificarTransferenciaInterrompida, diagnosticarELimparInterrompida, diagnosticarInicioDesabilitado } = require('../../comum/impedimento-transferencia')

const rota = { codigo: '704', nome: 'Transferência Remoagem Extrusão EX', local: 'Remoagem', origem: 'ME29', destino: 'ME07' }
const visivel = el => !el.closest('[hidden]')
const cartao = '<div class="row"><div><span>Local Transferência</span><div>' + rota.nome +
  '</div></div>\nTransferência\n12127\nOrigem / Destino Atual\nME29 -> ME07\n<div class="card-situations">Interrompido</div>' +
  '<button disabled>Parar</button><button>Limpar</button><button>Mais Informações</button></div>'

function fixture({ aoRegistrar, conclui = true, completo = true } = {}) {
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
      if (nome === 'Limpar') doc.body.insertAdjacentHTML('beforeend', '<section role="dialog"><p>Deseja realmente limpar a transferência</p><button>Sim</button></section>')
      if (nome === 'Sim') {
        doc.querySelector('[role=dialog]').remove()
        if (conclui) doc.body.innerHTML = '<p>Não há nenhuma transferência em uso</p>'
      }
    } }),
    wait: async () => { throw new Error('Encerramento não confirmado ao limpar a transferência.') },
    contains: texto => ({ should: async () => { assert.ok(doc.body.textContent.includes(texto)) } }),
    get: () => ({ should: fn => { fn([doc.body]); return Promise.resolve() } }),
    task: async (tarefa, dados) => {
      if (tarefa === 'diagnosticarEquipamentosS7') {
        assert.equal(dados, rota.codigo)
        eventos.push('diagnóstico S7')
        return { completo, detalhes: completo ? 'ME06 (DB1403): Emergência=true' : 'Leitura indisponível' }
      }
      assert.equal(tarefa, 'registrarEtapa')
      assert.match(dados.etapa, completo ? /12127.*ME06.*Emergência/ : /12127.*Leitura indisponível/)
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
    assert.deepEqual(f.eventos, ['diagnóstico S7', 'registro', 'Limpar', 'Sim'])
    assert.match(f.atual.detalhes, /ME06.*Emergência=true/)
    assert.match(f.atual.detalhes, /ME32 \(retorno não confirmado\)/)
    assert.doesNotMatch(f.atual.detalhes, /ME32 · Normal|ME29 · Sem emergência/)
    assert.match(f.atual.detalhes, /Limpeza confirmada/)
    assert.equal(f.execucao.anterior, null)
  } finally { f.fechar() }
})

test('Iniciar desabilitado sem S7 preserva a captura e o motivo do MES', async () => {
  const atual = { rota }
  await assert.rejects(diagnosticarInicioDesabilitado({
    cy: { task: () => assert.fail('Consulta S7 no modo MES') }, atual, pilotoS7: false,
    condicoes: 'Destino indisponível', capturar: async sufixo => assert.equal(sufixo, 'iniciar-desabilitado'),
  }), /Botão Iniciar desabilitado/)
  assert.match(atual.detalhes, /ME29 → ME07.*Destino indisponível/)
})

test('cartão trocado após o diagnóstico não recebe Limpar', async () => {
  const f = fixture({ aoRegistrar: doc => { doc.body.innerHTML = cartao.replace('12127', '12128') } })
  try {
    await assert.rejects(f.executar(), /mudou antes/)
    assert.deepEqual(f.eventos, ['diagnóstico S7', 'registro'])
    assert.ok(f.execucao.anterior)
  } finally { f.fechar() }
})

test('sem confirmação de local vazio conserva o bloqueio', async () => {
  const f = fixture({ conclui: false })
  try {
    await assert.rejects(f.executar(), /encerramento.*não confirmado/i)
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

test('diagnóstico incompleto é registrado e mantém o cartão para conferência', async () => {
  const f = fixture({ completo: false })
  try {
    await assert.rejects(f.executar(), /Diagnóstico dos DBs incompleto/)
    assert.deepEqual(f.eventos, ['diagnóstico S7', 'registro'])
    assert.match(f.atual.detalhes, /Leitura indisponível/)
    assert.ok(f.execucao.anterior)
  } finally { f.fechar() }
})
