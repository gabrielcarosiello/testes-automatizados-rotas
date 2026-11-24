const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { localizarComboEnsacados } = require('./combo-ensacados')

test('localiza as duas caixas rotuladas sem depender da aba ou da posição', () => {
  const { document } = new JSDOM('<main><div><span>Recebimento:</span><div><button class="form-select" id="modalidade"></button></div></div>' +
    '<div><label for="ordem">Ordem Recebimento:</label><select id="ordem"><option>9428</option></select></div></main>').window
  const ids = rotulo => localizarComboEnsacados(document, rotulo, () => true).map(el => el.id)
  assert.deepEqual(ids(/^recebimento\s*:?$/), ['modalidade'])
  assert.deepEqual(ids(/^ordem\s+(?:de\s+)?recebimento\s*:?$/), ['ordem'])
})
