const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const { test } = require('node:test')
const { JSDOM } = require('jsdom')

const spec = path.resolve(__dirname, '../../testes/dosagem/cadastro-producao.cy.js')

test('a spec registra e executa a consulta rotuloLiberacao do Cypress', () => {
  const doc = new JSDOM('<main role="tabpanel"><dxbl-check>' +
    '<div class="dxbl-checkbox-check-element"><input id="teste" type="checkbox"></div>' +
    '<label for="teste"> Liberada para Produção </label></dxbl-check></main>').window.document
  const consultas = new Map()
  const caixa = valor => valor === doc
    ? { find: seletor => [...doc.querySelectorAll(seletor.replace(':visible', ''))] }
    : valor

  vm.runInNewContext(fs.readFileSync(spec, 'utf8'), {
    require: id => id === '../../comum/consultas-mes' ? {} : createRequire(spec)(id),
    Cypress: {
      Commands: { addQuery: (nome, consulta) => consultas.set(nome, consulta) },
      $: caixa,
      dom: { isVisible: () => true },
    },
    cy: { state: () => doc },
    describe: (_, configuracao, registrar) => {
      assert.equal(configuracao.viewportWidth, 1920)
      assert.equal(configuracao.viewportHeight, 900)
      registrar()
    },
    it() {},
    afterEach() {},
  }, { filename: spec })

  const registrar = consultas.get('rotuloLiberacao')
  assert.equal(typeof registrar, 'function', 'a spec deve registrar o comando que usa para liberar a produção')
  const executar = registrar.call({ set() {} })
  const rotulos = executar()
  assert.equal(rotulos.length, 1)
  assert.equal(rotulos[0].control, doc.getElementById('teste'))
})
