const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const { criarEstadoEscrita } = require('../../comum/s7/estado-escrita')
const { criarControleNivel, configuracaoNivel } = require('../../comum/s7/nivel-alto')
const { configurarContatoLSH } = require('../../comum/s7/contato-lsh')
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

function integrar(t, arquivos = fs) {
  const esperas = [], comandos = []
  const raiz = pasta(t)
  const estado = criarEstadoEscrita(raiz, { host: '127.0.0.2' }, { arquivos, esperar: ms => esperas.push(ms) })
  const c = { codigo: 91, resultado: { ok: true }, connection: 'teste', lsh: { id: 'lsh', address: 'I34.6', valorInicial: false }, alarme: { id: 'alm', address: 'DB3031,X1.0' } }
  const s = { entrada: false, sequencia: 0, acionamento: null, amostraAntiga: false }
  const controle = criarControleNivel({
    getContext: () => c, cfg: configuracaoNivel({ nivelAlto: { habilitado: true } }), contato: configurarContatoLSH(0), pollMs: 200,
    registrarEscrita: estado.registrar, exigirPropriedade: estado.exigirPropriedade,
    async chamar(url, op) {
      if (url === '/api/escrita') {
        const { value } = JSON.parse(op.body)
        assert.ok(estado.ler())
        comandos.push(value)
        if (value && s.acionamento) await s.acionamento
        s.entrada = value
        return { acknowledged: true, verified: true, observed: value, sequence: ++s.sequencia }
      }
      return { connection: 'teste', mode: 's7', state: 'ok', connected: true,
        sequence: s.amostraAntiga ? 1 : ++s.sequencia, receivedAt: new Date().toISOString(),
        tags: [{ ...c.lsh, good: true, value: s.amostraAntiga ? false : s.entrada }, { ...c.alarme, good: true, value: false }] }
    },
  })
  return { raiz, estado, controle, c, s, comandos, esperas }
}

const falha = code => Object.assign(new Error(code), { code })

test('EPERM transitório repete apenas a substituição, com o registro anterior intacto', async t => {
  const chamadas = []
  const x = integrar(t, { ...fs, renameSync(origem, destino) {
    assert.equal(x.estado.ler().fase, 'solicitada')
    chamadas.push(origem)
    if (chamadas.length < 3) throw falha('EPERM')
    fs.renameSync(origem, destino)
  } })
  await x.controle.acionarNivelAltoS7()
  assert.deepEqual(x.esperas, [25, 50])
  assert.equal(new Set(chamadas).size, 1)
  assert.equal(x.estado.ler().fase, 'confirmada')
  assert.deepEqual(x.comandos, [true])
  assert.equal((await x.controle.restaurarNivelAltoS7()).ok, true)
  assert.deepEqual(x.comandos, [true, false])
})

test('EPERM persistente após o POST mantém intenção e temporário, e permite restaurar sem repetir o acionamento', async t => {
  const x = integrar(t, { ...fs, renameSync() { throw falha('EPERM') } })
  await assert.rejects(x.controle.acionarNivelAltoS7(), /rename falhou \(EPERM\) após 4/)
  assert.equal(x.c.nivel.escrita.verified, true)
  assert.equal(x.s.entrada, true)
  assert.deepEqual(x.esperas, [25, 50, 100])
  const outraInstancia = criarEstadoEscrita(x.raiz, {})
  assert.throws(outraInstancia.exigirLivre, /Restauração pendente/)
  assert.equal(outraInstancia.ler().fase, 'solicitada')
  const diretorio = path.dirname(x.estado.arquivo)
  const temporario = fs.readdirSync(diretorio).find(nome => nome.endsWith('.tmp'))
  const comprovante = JSON.parse(fs.readFileSync(path.join(diretorio, temporario), 'utf8'))
  assert.equal(comprovante.fase, 'confirmada')
  assert.equal(comprovante.owner, outraInstancia.ler().owner)
  await assert.rejects(x.controle.acionarNivelAltoS7(), /já foi solicitado/)
  x.s.amostraAntiga = true
  assert.equal((await x.controle.restaurarNivelAltoS7()).ok, false)
  assert.deepEqual(x.comandos, [true])
  x.s.amostraAntiga = false
  assert.equal((await x.controle.restaurarNivelAltoS7()).ok, true)
  assert.equal(x.c.nivel.escritaRestauracao.observed, false)
  assert.deepEqual(x.comandos, [true, false])
  assert.equal(outraInstancia.ler(), null)
  assert.ok(fs.existsSync(path.join(diretorio, temporario)))
})

test('falha de fsync na intenção impede qualquer POST e deixa a execução seguinte bloqueada', async t => {
  const x = integrar(t, { ...fs, fsyncSync() { throw falha('EIO') } })
  await assert.rejects(x.controle.acionarNivelAltoS7(), /solicitada.*EIO/)
  assert.deepEqual(x.comandos, [])
  assert.equal((await x.controle.restaurarNivelAltoS7()).necessario, false)
  assert.throws(() => criarEstadoEscrita(x.raiz, {}).exigirLivre(), /Restauração pendente/)
})

test('outra instância não toma posse e a restauração concorrente não antecipa o POST', async t => {
  const x = integrar(t)
  let liberar
  x.s.acionamento = new Promise(resolve => { liberar = resolve })
  const acionando = x.controle.acionarNivelAltoS7()
  await new Promise(resolve => setImmediate(resolve))
  assert.throws(() => criarEstadoEscrita(x.raiz, {}).registrar('solicitada', {
    ...x.c, nivel: { ...x.c.nivel, id: 'concorrente' },
  }), /Já existe escrita pendente/)
  assert.equal((await x.controle.restaurarNivelAltoS7()).ok, false)
  assert.deepEqual(x.comandos, [true])
  liberar()
  await acionando
  const restaurando = x.controle.restaurarNivelAltoS7()
  assert.equal((await x.controle.restaurarNivelAltoS7()).ok, false)
  assert.equal((await restaurando).ok, true)
  assert.deepEqual(x.comandos, [true, false])
})

test('falha de unlink após restauração confirmada permite nova conferência sem novo POST', async t => {
  let bloqueado = true
  const x = integrar(t, { ...fs, unlinkSync(arquivo) {
    if (bloqueado) throw falha('EPERM')
    fs.unlinkSync(arquivo)
  } })
  await x.controle.acionarNivelAltoS7()
  const restauracao = await x.controle.restaurarNivelAltoS7()
  assert.equal(restauracao.ok, false)
  assert.match(restauracao.detalhe, /unlink falhou/)
  assert.equal(x.estado.ler().fase, 'confirmada')
  assert.equal(x.c.nivel.escritaRestauracao.verified, true)
  bloqueado = false
  assert.equal((await x.controle.restaurarNivelAltoS7()).ok, true)
  assert.deepEqual(x.comandos, [true, false])
})

test('Windows: destino somente leitura impede substituição real e o registro continua recuperável', { skip: process.platform !== 'win32' }, async t => {
  const x = integrar(t, { ...fs, renameSync(origem, destino) {
    fs.chmodSync(destino, 0o444)
    try { fs.renameSync(origem, destino) } finally { fs.chmodSync(destino, 0o666) }
  } })
  await assert.rejects(x.controle.acionarNivelAltoS7(), /rename falhou \((EPERM|EACCES)\) após 4/)
  assert.equal(x.estado.ler().fase, 'solicitada')
  assert.equal((await x.controle.restaurarNivelAltoS7()).ok, true)
  assert.deepEqual(x.comandos, [true, false])
})
