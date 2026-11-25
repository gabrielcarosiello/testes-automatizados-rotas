const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const { test } = require('node:test')
const assert = require('node:assert/strict')

const arquivo = path.join(__dirname, '../../testes/recebimentos/s7.js')
const fonte = fs.readFileSync(arquivo, 'utf8')
const carregar = createRequire(arquivo)
const identidade = { ordem: '9407', codigoRota: 14, destino: 'MG01', codigoProduto: 'MILHO', modalidade: 'Grãos RG' }

function simular(t, respostas) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'recebimento-entrega-'))
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }))
  const modulo = { exports: {} }
  vm.runInNewContext(fonte, {
    module: modulo,
    require: id => id === '../../comum/s7/consultarRota' ? respostas : carregar(id),
  })
  return { raiz, tarefas: modulo.exports.tarefasRecebimento(raiz) }
}

function lerEvento(raiz, resultado) {
  return JSON.parse(fs.readFileSync(path.join(raiz, resultado.evidencia), 'utf8'))
}

for (const aposIniciar of [true, false]) {
  test('grava a entrega de granel para OR ' + (aposIniciar ? 'recém-recebida' : 'já recebida'), async t => {
    const confirmado = { item: 1, pesoRecebido: 1000, saldoSilo: 1250, finalizadoEm: '2026-11-25T15:00:00Z' }
    const caso = simular(t, { consultarRecebimentoNoSilo: async dados => {
      const { ordem, codigoRota, destino, codigoProduto } = identidade
      assert.deepEqual({ ...dados }, { ordem, codigoRota, destino, codigoProduto })
      return confirmado
    } })
    const resultado = await caso.tarefas.verificarRecebimentoNoSilo({ ...identidade, aposIniciar })
    const evento = lerEvento(caso.raiz, resultado)
    assert.equal(evento.tipo, aposIniciar ? 'recebimento-confirmado' : 'recebimento-ja-confirmado')
    assert.deepEqual(evento.dados.entrega, {
      origem: aposIniciar ? 'nesta-execucao' : 'ja-recebido',
      modalidade: 'Grãos RG', ordem: '9407', codigoProduto: 'MILHO', item: 1, codigoRota: '14',
      destino: { tipo: 'silo', codigo: 'MG01' }, pesoRecebidoKg: 1000, saldoSiloKg: 1250,
      confirmadoEm: confirmado.finalizadoEm,
    })
  })
}

test('registra quantidade e armazém para Ensacados', async t => {
  const caso = simular(t, { consultarRecebimentoEnsacados: async dados => {
    assert.deepEqual({ ...dados }, { numero: '9428', codigoProduto: 'MICRO' })
    return { item: 1, quantidadeRecebida: 10, pesoRecebido: 250, armazem: 1, recebidoEm: '2026-11-25T15:00:00Z' }
  } })
  const resultado = await caso.tarefas.verificarRecebimentoEnsacados({ numero: '9428', codigoProduto: 'MICRO', aposIniciar: true })
  const { entrega } = lerEvento(caso.raiz, resultado).dados
  assert.equal(entrega.ordem, '9428')
  assert.equal(entrega.codigoProduto, 'MICRO')
  assert.equal(entrega.quantidadeRecebida, 10)
  assert.equal(entrega.pesoRecebidoKg, 250)
  assert.deepEqual(entrega.destino, { tipo: 'armazem', codigo: 1 })
})

test('não grava uma entrega sem confirmação SQL da identidade consultada', async t => {
  const caso = simular(t, { consultarRecebimentoNoSilo: async () => null, consultarRecebimentoEnsacados: async () => null })
  assert.equal(await caso.tarefas.verificarRecebimentoNoSilo({ ...identidade, codigoProduto: 'OUTRO', aposIniciar: true }), null)
  assert.equal(await caso.tarefas.verificarRecebimentoEnsacados({ numero: '9428', codigoProduto: 'OUTRO' }), null)
  assert.deepEqual(fs.readdirSync(caso.raiz), [])
})
