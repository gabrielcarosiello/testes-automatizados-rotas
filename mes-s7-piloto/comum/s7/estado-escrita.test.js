const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const { criarEstadoEscrita } = require('./estado-escrita')
const { criarControleNivel, configuracaoNivel } = require('./nivel-alto')
const { configurarContatoLSH } = require('./contato-lsh')
function pasta(t) { const p = fs.mkdtempSync(path.join(os.tmpdir(), 's7-estado-')); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p }
test('escrita pendente sobrevive a outra instância e só seu proprietário pode removê-la', t => {
  const root = pasta(t), estado = criarEstadoEscrita(root, { host: '127.0.0.2' })
  const c = { codigo: 91, lsh: { address: 'I34.6', valorInicial: false }, nivel: { id: 'dono', valorSolicitado: true } }
  estado.exigirLivre(); estado.registrar('solicitada', c)
  assert.throws(() => criarEstadoEscrita(root, {}).exigirLivre(), /Restauração pendente.*I34.6/)
  assert.equal(estado.ler().destino, true)
  assert.throws(() => estado.registrar('restaurada', { ...c, nivel: { id: 'outro' } }), /outra escrita/)
  assert.ok(estado.ler()); estado.registrar('confirmada', c); estado.registrar('restaurada', c); estado.exigirLivre()
  fs.writeFileSync(estado.arquivo, '{quebrado'); assert.throws(() => estado.exigirLivre(), /Não foi possível conferir/)
})
test('controle grava antes do POST, mantém registro em resposta perdida e remove após restauração', async t => {
  const estado = criarEstadoEscrita(pasta(t), { host: '127.0.0.2' }); let entrada = false, sequencia = 0, perder = true
  const c = { codigo: 91, resultado: { ok: true }, connection: 'teste', lsh: { id: 'lsh', address: 'I34.6', valorInicial: false }, alarme: { id: 'alm', address: 'DB3031,X1.0' } }
  const control = criarControleNivel({ getContext: () => c, cfg: configuracaoNivel({ nivelAlto: { habilitado: true } }), contato: configurarContatoLSH(0), pollMs: 200, registrarEscrita: estado.registrar, chamar: async (url, op) => {
    if (url === '/api/escrita') { assert.ok(estado.ler(), 'registro antes do comando'); entrada = JSON.parse(op.body).value; if (perder) throw new Error('resposta perdida'); return { acknowledged: true, verified: true, observed: entrada } }
    return { connection: 'teste', mode: 's7', state: 'ok', connected: true, sequence: ++sequencia, receivedAt: new Date().toISOString(), tags: [{ ...c.lsh, good: true, value: entrada }, { ...c.alarme, good: true, value: false }] }
  } })
  await assert.rejects(control.acionarNivelAltoS7(), /resposta perdida/); assert.equal(entrada, true); assert.ok(estado.ler())
  perder = false; assert.equal((await control.restaurarNivelAltoS7()).ok, true); assert.equal(entrada, false); assert.equal(estado.ler(), null)
})
