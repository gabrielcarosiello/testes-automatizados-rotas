const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm'), { createRequire } = require('node:module')
const { resumirEventos } = require('./resumo-execucao')
function ambiente(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'persistencia-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'planilhas')); fs.copyFileSync(path.join(__dirname, 'fixtures/LIR_regressao.xlsx'), path.join(root, 'planilhas', 'ativa.xlsx'))
  const arquivo = path.resolve(__dirname, '../testes/transferencias/config.js'), requireReal = createRequire(arquivo), modulo = { exports: {} }
  vm.runInNewContext(fs.readFileSync(arquivo, 'utf8'), { module: modulo, console: { log() {}, error() {} }, process,
    require: id => id === 'cypress' ? { defineConfig: x => x } : requireReal(id),
  })
  const tasks = {}; const config = modulo.exports.e2e.setupNodeEvents((tipo, valores) => Object.assign(tasks, valores), { projectRoot: root, env: {}, expose: {} })
  const pasta = tasks.iniciarRev00(), rota = config.expose.rotas[0]
  return { root, tasks, pasta, rota }
}
test('resultado é preservado em JSONL mesmo se a escrita XLSX falhar; etapa e erro ficam auditáveis', t => {
  const { root, tasks, pasta, rota } = ambiente(t)
  tasks.registrarEtapa({ pasta, codigo: rota.codigo, etapa: 'Preparar leitura S7' })
  assert.throws(() => tasks.registrarEtapa({ pasta, codigo: 999, etapa: 'X' }), /inválida/)
  const historico = path.join(root, 'resultados', pasta, 'historico-rev00.xlsx'); fs.unlinkSync(historico); fs.mkdirSync(historico)
  const retorno = tasks.registrarRev00({ ...rota, pasta, resultado: 'Falhou', resultadoNormal: 'Falhou', detalhes: 'erro de teste', etapa: 'Preparar leitura S7' })
  assert.ok(retorno.aviso)
  const jsonl = path.join(root, 'resultados', pasta, 'eventos.jsonl'), resumo = resumirEventos(jsonl)
  assert.equal(resumo.totalRegistrado, 1); assert.equal(resumo.falhas, 1); assert.deepEqual(resumo.persistenciasPendentes, [rota.codigo])
  assert.match(fs.readFileSync(jsonl, 'utf8'), /falha-persistencia/)
})

test('histórico Rev 00 conserva o diagnóstico detalhado quando a LIR recebe o resumo', t => {
  const { root, tasks, pasta, rota } = ambiente(t)
  const XLSX = require('xlsx')
  const detalhes = 'ME06 (DB1403): AlarmeEmergencia=true, Equipamento em emergência (DB1403,X7.2) | ME21: suspensão não verificada'
  const falhaLir = 'Identificados equipamentos em emergência — ME06'
  const retorno = tasks.registrarRev00({ ...rota, pasta, resultado: 'Falhou', etapa: 'Verificar botão Iniciar', detalhes, falhaLir })
  assert.equal(retorno.aviso, '')
  const historico = XLSX.readFile(path.join(root, 'resultados', pasta, 'historico-rev00.xlsx'))
  const [resultado] = XLSX.utils.sheet_to_json(historico.Sheets.Resultados)
  assert.equal(resultado.Detalhes, detalhes)
  const lir = XLSX.readFile(path.join(root, 'planilhas', 'ativa.xlsx'))
  assert.equal(lir.Sheets['Lista de Rotas - Transferências']['N' + rota.linha].v, falhaLir)
})
