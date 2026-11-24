'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { lerSenhaMes } = require('./credenciais-mes')

test('usa somente o arquivo local na raiz do projeto e informa o caminho esperado', t => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'piloto-cred-'))
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }))
  const arquivo = path.join(raiz, 'credenciais.local.json')
  fs.writeFileSync(path.join(raiz, 'credenciais.exemplo.json'), '{"senhaMES":"exemplo"}')
  const ausente = lerSenhaMes(raiz)
  assert.equal(ausente.senha, undefined)
  assert.ok(ausente.erro.includes(arquivo))

  fs.writeFileSync(arquivo, '{"senhaMES": "senha-sintetica-{enter}",')
  assert.match(lerSenhaMes(raiz).erro, /JSON inválido/)
  assert.doesNotMatch(lerSenhaMes(raiz).erro, /senha-sintetica/)
  assert.deepEqual(lerSenhaMes(raiz, 'senha-injetada'), { senha: 'senha-injetada' })

  fs.writeFileSync(arquivo, '{"senhaMES":"   "}')
  assert.match(lerSenhaMes(raiz).erro, /ausente ou vazia/)
})

test('preserva a senha literal em UTF-8 com BOM e UTF-16 do Windows', t => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'piloto-cred-'))
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }))
  const arquivo = path.join(raiz, 'credenciais.local.json')
  const senhaMES = ' senha-sintética-{enter} '
  const texto = '\uFEFF' + JSON.stringify({ senhaMES })
  for (const bytes of [Buffer.from(texto, 'utf8'), Buffer.from(texto, 'utf16le'), Buffer.from(texto, 'utf16le').swap16()]) {
    fs.writeFileSync(arquivo, bytes)
    assert.deepEqual(lerSenhaMes(raiz), { senha: senhaMES })
  }
})
