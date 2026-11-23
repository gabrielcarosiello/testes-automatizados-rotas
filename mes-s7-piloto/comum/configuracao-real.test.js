const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')

function carregarConfig(arquivo) {
  const modulo = { exports: {} }, resolver = createRequire(arquivo)
  vm.runInNewContext(fs.readFileSync(arquivo, 'utf8'), { module: modulo, __dirname: path.dirname(arquivo), console: { log() {} }, process,
    require(id) {
      if (id === 'cypress') return { defineConfig: objeto => objeto }
      if (['./cypress.base.config', './testes/transferencias/config'].includes(id)) return carregarConfig(resolver.resolve(id))
      return resolver(id)
    },
  })
  return modulo.exports
}

test('configuração completa com LIR.04 real autoriza 91 OK, registra tarefas e revalida antes do MES', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'piloto-config-real-'))
  try {
    fs.mkdirSync(path.join(dir, 'planilhas'))
    fs.copyFileSync(path.join(root, 'comum', 'fixtures', 'LIR_regressao.xlsx'), path.join(dir, 'planilhas', 'projeto.xlsx'))
    fs.writeFileSync(path.join(dir, 's7.local.json'), JSON.stringify({ habilitado: true, codigoRota: 91,
      monitor: 'http://127.0.0.1:3000', host: '127.0.0.2', rack: 0, slot: 1, pollMs: 200, fonteCatalogo: 'monitor', tipoContatoLSH: 0, incluirLSHNoMonitor: true, escritaManualLSH: true, nivelAlto: { habilitado: true, alarmesConfirmados: { LSH_MG14: 'DB3031,X1.0' } } }))
    const senhaDeTeste = 'senha-sintetica-{enter}'
    fs.writeFileSync(path.join(dir, 'credenciais.local.json'), JSON.stringify({ senhaMES: senhaDeTeste }))
    const tasks = {}
    const config = carregarConfig(path.join(root, 'cypress.config.js')).e2e.setupNodeEvents((tipo, handlers) => { if (tipo === 'task') Object.assign(tasks, handlers) }, {
      projectRoot: dir, env: {}, specPattern: 'testes/**/*.cy.js',
    })
    const dados = config.expose.catalogoRev00
    assert.equal(dados.erro, undefined)
    assert.equal(config.env.senhaMES, senhaDeTeste)
    assert.equal(JSON.stringify(dados).includes(senhaDeTeste), false)
    assert.equal(dados.nivelAltoHabilitado, true)
    assert.equal(dados.mensagemSemPendencias, undefined)
    assert.equal(dados.rotas.length, 1)
    assert.equal(dados.rotas[0].codigo, '91')
    assert.equal(dados.rotas[0].tipoExecucao, 'reteste')
    assert.equal(dados.validacaoLir.total, 265)
    assert.equal(dados.validacaoLir.teste.OK, 263)
    assert.equal(dados.validacaoLir.nivelAlto.pendentesComSinal, 257)
    assert.equal(tasks.validarRotaLir(91).statusInicial, 'OK')
    assert.throws(() => tasks.validarRotaLir(999), /não autorizada/)
    assert.equal(typeof tasks.validarCatalogoS7, 'function')
    assert.equal(typeof tasks.prepararS7, 'function')
    assert.equal(typeof tasks.acionarNivelAltoS7, 'function')
    assert.equal(typeof tasks.restaurarNivelAltoS7, 'function')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
