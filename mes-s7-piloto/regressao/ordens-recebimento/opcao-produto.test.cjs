const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { localizarOpcaoProduto } = require('../../testes/ordens-recebimento/opcao-produto')

test('seleciona somente o código exato na lista aberta, inclusive em grade sem tr', () => {
  const { document } = new JSDOM('<main><div><span>Milho CG Moído</span><span>34130CP|GR</span></div>' +
    '<section><div><input placeholder="Buscar..."></div><div role="listbox">' +
    '<div role="option"><span>Milho CG Moído</span><span>34130CP|GR-X</span></div>' +
    '<div role="option"><span>Milho CG Moído</span><span id="codigo">34130CP|GR</span></div></div></section></main>').window
  const ler = () => localizarOpcaoProduto(document, '34130CP|GR', 'Milho CG Moído', () => true)
  assert.equal(ler(), document.querySelector('#codigo'))
  document.querySelector('#codigo').parentElement.remove()
  assert.equal(ler(), null)
})
