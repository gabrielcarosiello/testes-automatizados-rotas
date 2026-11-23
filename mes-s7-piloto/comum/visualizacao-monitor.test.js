const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { montarPainel, renderizar } = require('./visualizacao-monitor')
const { statusNivelNoMes, acompanharNivelAlto } = require('./nivel-alto-mes')
const { classificarFalha } = require('./registro-execucao')

test('tabela única usa toda a largura sem quadro/coluna vazia e pagina por altura', () => {
  const dom = new JSDOM('<body></body>')
  try {
    Object.defineProperty(dom.window, 'innerWidth', { value: 1000 }); Object.defineProperty(dom.window, 'innerHeight', { value: 660 })
    montarPainel(dom.window.document, '91')
    const tags = Array.from({ length: 8 }, (_, i) => ({ label: 'EQP' + i, address: 'DB1,X' + i + '.0', good: true, value: true }))
    assert.equal(renderizar(dom.window.document, { tags, ok: true }), 1)
    assert.equal(dom.window.document.querySelectorAll('table').length, 1)
    assert.equal(dom.window.document.querySelector('table').style.width, '100%')
    assert.equal(dom.window.document.querySelectorAll('tr').length, 9)
    assert.ok(renderizar(dom.window.document, { tags: [...tags, ...tags, ...tags, ...tags], ok: true }) > 1)
  } finally { dom.window.close() }
})
test('MES confirma Nível Alto somente no cartão correto e sem Iniciado concomitante', () => {
  const dom = new JSDOM('<div class="row"><div><span>Local</span><span>Transferência</span></div><div class="card-situations">Nível Alto</div></div>')
  try {
    const doc = dom.window.document, visible = () => true
    assert.equal(statusNivelNoMes(doc, 'Transferência', 'Nível Alto', visible), 'Nível Alto')
    assert.equal(statusNivelNoMes(doc, 'Outra', 'Nível Alto', visible), null)
    const status = doc.createElement('div'); status.className = 'card-situations'; status.textContent = 'Iniciado'; doc.querySelector('.row').append(status)
    assert.equal(statusNivelNoMes(doc, 'Transferência', 'Nível Alto', visible), null)
  } finally { dom.window.close() }
})

test('timeout só indica validação da FC quando o CLP confirmou e o MES segue sem Nível Alto', async () => {
  const dom = new JSDOM('<div class="row"><div><span>Local</span><span>Transferência</span></div><div class="card-situations">Iniciado</div></div>')
  const rota = { codigo: '131', nome: 'Transferência', rota: 'RG16-RG18-RG04-RG06-RG11', origem: 'RG16', destino: 'RG11' }
  const resultado = {
    ok: false, concluido: true, confirmadoClp: true, statusMes: 'Nível Alto',
    detalhe: 'Prazo para confirmar nível alto no DB e no MES esgotado.',
  }
  let consultasMes = 0
  global.Cypress = { dom: { isVisible: () => true } }
  global.cy = {
    task: async nome => {
      assert.equal(nome, 'consultarNivelAltoS7')
      return resultado
    },
    document: async () => {
      consultasMes++
      return dom.window.document
    },
  }
  const conferir = () => acompanharNivelAlto(rota, () => assert.fail('O timeout encerra a consulta'))
  try {
    await assert.rejects(conferir(), erro => {
      assert.match(erro.message, /Nível alto confirmado no CLP e não confirmado no MES para a rota 131 \(RG16 → RG11\)/)
      assert.match(erro.message, /Validar a FC do transporte correspondente.*RG16-RG18-RG04-RG06-RG11/)
      assert.equal(classificarFalha({ resultado: 'Falhou', detalhes: erro.message }), 'nivel-alto-confirmado-clp-sem-mes')
      return true
    })

    resultado.silo = { address: 'DB11,X81.4', label: 'Silo[2].Niveis.Alto', good: true, value: false }
    await assert.rejects(conferir(), /DB11,X81\.4\)=0.*sem propagação ao silo.*Validar a FC/)
    resultado.silo.value = true
    await assert.rejects(conferir(), /DB11,X81\.4\)=1.*Validar a leitura do DB11/)
    resultado.silo.good = false
    await assert.rejects(conferir(), /DB11 sem leitura confirmada/)

    dom.window.document.querySelector('.card-situations').textContent = 'Nível Alto'
    await assert.rejects(conferir(), { message: resultado.detalhe })

    resultado.confirmadoClp = false
    await assert.rejects(conferir(), { message: resultado.detalhe })
    assert.equal(consultasMes, 5)
  } finally {
    delete global.cy
    delete global.Cypress
    dom.window.close()
  }
})
