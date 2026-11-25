const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { tarefasEvidenciasDosagem } = require('../../testes/dosagem/evidencias')

test('grava a falha original mesmo quando a pasta do diário ainda não existe', t => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'dosagem-evidencia-'))
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }))
  const { registrarEvidenciaDosagem: registrar } = tarefasEvidenciasDosagem(raiz)
  const dados = { lote: '1795637945808', tipo: 'resultado', resultado: 'failed', erro: 'Falha anterior ao primeiro comando.' }
  const arquivo = registrar(dados)
  const evento = JSON.parse(fs.readFileSync(path.join(raiz, arquivo), 'utf8'))
  assert.equal(evento.tipo, 'resultado')
  assert.equal(evento.dados.resultado, 'failed')
  assert.equal(evento.dados.erro, dados.erro)
  assert.throws(() => registrar({ ...dados, lote: '1795637945809', resultado: 'passed' }), { code: 'ENOENT' })
})
