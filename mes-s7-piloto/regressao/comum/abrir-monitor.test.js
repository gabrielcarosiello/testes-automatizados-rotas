const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

test('abre a origem do Monitor, consulta API e retorna ao MES nessa ordem', () => {
  const chamadas = []
  const modulo = { exports: {} }
  const cy = {
    log: mensagem => chamadas.push(['log', mensagem]),
    origin: (url, callback) => {
      chamadas.push(['origin', url])
      callback()
    },
    visit: url => { chamadas.push(['visit', url]); return 'retorno-mes' },
    get: seletor => ({ should: condicao => chamadas.push(['get', seletor, condicao]) }),
    title: () => ({ should: () => {} }),
    request: opcoes => ({
      then: callback => {
        chamadas.push(['request', opcoes.url])
        callback({ status: 503, body: { tags: [], mode: 'demo', state: 'indisponivel' } })
      },
    }),
  }
  const expect = valor => ({
    to: { be: {
      oneOf: lista => assert.ok(lista.includes(valor)),
      an: tipo => { assert.equal(tipo, 'array'); assert.ok(Array.isArray(valor)) },
    } },
  })
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../comum/abrir-monitor.js'), 'utf8'), {
    module: modulo, cy, expect, URL,
  })
  const resultado = modulo.exports.abrirMonitorERetornar('http://127.0.0.1:3000', 'http://localhost/nexxus-mes')
  assert.equal(resultado, 'retorno-mes')
  assert.deepEqual(chamadas.filter(([tipo]) => ['origin', 'visit', 'request'].includes(tipo)), [
    ['origin', 'http://127.0.0.1:3000'],
    ['visit', '/'],
    ['request', 'http://127.0.0.1:3000/api/tags'],
    ['visit', 'http://localhost/nexxus-mes'],
  ])
})
