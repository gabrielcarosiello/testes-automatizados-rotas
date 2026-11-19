const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm'), { createRequire } = require('node:module')
const { resumirEventos } = require('./resumo-execucao')
test('resultado é preservado em JSONL mesmo se a escrita XLSX falhar; etapa e erro ficam auditáveis', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'persistencia-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'planilhas')); fs.copyFileSync(path.join(__dirname, 'fixtures/LIR_regressao.xlsx'), path.join(root, 'planilhas', 'ativa.xlsx'))
  const arquivo = path.resolve(__dirname, '../testes/transferencias/config.js'), requireReal = createRequire(arquivo), modulo = { exports: {} }
  vm.runInNewContext(fs.readFileSync(arquivo, 'utf8'), { module: modulo, console: { log() {}, error() {} }, process,
    require: id => id === 'cypress' ? { defineConfig: x => x } : requireReal(id),
  })
  const tasks = {}; const config = modulo.exports.e2e.setupNodeEvents((tipo, valores) => Object.assign(tasks, valores), { projectRoot: root, env: {}, expose: {} })
  const pasta = tasks.iniciarRev00(), rota = config.expose.rotas[0]
  tasks.registrarEtapa({ pasta, codigo: rota.codigo, etapa: 'Preparar leitura S7' })
  assert.throws(() => tasks.registrarEtapa({ pasta, codigo: 999, etapa: 'X' }), /inválida/)
  const historico = path.join(root, 'resultados', pasta, 'historico-rev00.xlsx'); fs.unlinkSync(historico); fs.mkdirSync(historico)
  const retorno = tasks.registrarRev00({ ...rota, pasta, resultado: 'Falhou', resultadoNormal: 'Falhou', detalhes: 'erro de teste', etapa: 'Preparar leitura S7' })
  assert.ok(retorno.aviso)
  const jsonl = path.join(root, 'resultados', pasta, 'eventos.jsonl'), resumo = resumirEventos(jsonl)
  assert.equal(resumo.totalRegistrado, 1); assert.equal(resumo.falhas, 1); assert.deepEqual(resumo.persistenciasPendentes, [rota.codigo])
  assert.match(fs.readFileSync(jsonl, 'utf8'), /falha-persistencia/)
})
