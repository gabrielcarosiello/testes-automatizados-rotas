const fs = require('fs')
const path = require('path')
const { defineConfig } = require('cypress')
const { piloto: versaoPiloto } = require('./versao.json')
const { criarPiloto } = require('./comum/s7/piloto')
const { configuracaoNivel } = require('./comum/s7/nivel-alto')
const base = require('./cypress.base.config')
const { lerExecucao } = require('./comum/execucao')
const { lerSenhaMes } = require('./comum/credenciais-mes')

module.exports = defineConfig({
  ...base,
  video: false,
  retries: 0,
  watchForFileChanges: false,
  trashAssetsBeforeRuns: false,
  screenshotsFolder: path.join(__dirname, 'resultados'),
  e2e: {
    ...base.e2e,
    testIsolation: false,
    supportFile: false,
    specPattern: ['testes/**/*.cy.js', 'testes/recebimentos/recebimento.js', 'testes/recebimentos/recebimento-ensacados.js', 'testes/ordens-recebimento/*.{ordem,ensacados}.js'],
    // Executado ao carregar o projeto: resolve LIR, tarefas e opções públicas.
    // Senha MES permanece no Node e é solicitada pelo teste com cy.env.
    setupNodeEvents(on, config) {
      const resultado = base.e2e.setupNodeEvents(on, config) || config
      const { senha, erro: erroSenhaMes } = lerSenhaMes(config.projectRoot, resultado.env?.senhaMES)
      if (senha) resultado.env = { ...resultado.env, senhaMES: senha }
      if (!String(config.specPattern || '').includes('testes')) return resultado
      resultado.expose = resultado.expose || {}
      on('task', require('./testes/dosagem/evidencias').tarefasEvidenciasDosagem(config.projectRoot))
      on('task', require('./testes/ordens-recebimento/evidencias').tarefasEvidenciasOrdem(config.projectRoot, senha))
      try {
        const execucao = lerExecucao(config.projectRoot)
        on('task', require('./testes/recebimentos/s7').tarefasRecebimento(config.projectRoot, execucao.planilha))
        resultado.expose.recebimento = { urlMes: execucao.urlMes, usuarioMes: execucao.usuarioMes, erroSenhaMes }
        resultado.numTestsKeptInMemory = execucao.numTestsKeptInMemory
        const arquivoS7 = path.join(config.projectRoot, 's7.local.json')
        const s7 = fs.existsSync(arquivoS7) ? JSON.parse(fs.readFileSync(arquivoS7, 'utf8').replace(/^\uFEFF/, '')) : null
        const nivelAlto = configuracaoNivel(s7 || {})
        if (nivelAlto.habilitado && s7?.habilitado !== true) throw new Error('O ensaio de nível alto exige habilitado=true (MES + S7).')
        const auxiliar = require('./testes/transferencias/config')
        const isolada = { ...resultado, env: { ...resultado.env }, expose: {} }
        const dados = auxiliar.e2e.setupNodeEvents(on, isolada, { codigoRota: s7?.codigoRota, testarNivelAlto: nivelAlto.habilitado, planilha: execucao.planilha, modoSelecao: execucao.selecaoRotas }) || isolada
        const rotas = dados.expose.rotas
        let pilotoS7 = false
        let monitorS7 = null
        if (rotas.length) {
          if (!s7) {
            throw new Error('Configure s7.local.json a partir de s7.exemplo.json. Use habilitado true para MES + S7 ou false para MES.')
          }
          if (typeof s7.habilitado !== 'boolean') {
            throw new Error('Defina habilitado como true ou false em s7.local.json.')
          }
          pilotoS7 = s7.habilitado
          monitorS7 = s7.monitor
          if (pilotoS7 && dados.expose.retomarPasta) throw new Error('Inicie a integração S7 sem retomar resultados de outra execução.')
          if (pilotoS7) on('task', criarPiloto(config.projectRoot, undefined, {
            rotas, prevalidarSql: true, consultarSilo: destino => require('./comum/s7/consultarRota').consultarSilo(destino),
          }))
          console.log(`[${versaoPiloto}] Modo ${pilotoS7 ? 'MES + S7' : 'MES'}; rotas ${rotas.map(rota => rota.codigo).join(', ')}`)
          if (pilotoS7) console.log(`[S7] Monitor ${s7.monitor}. A leitura ocorre pela API enquanto a tela permanece no MES.`)
        }
        resultado.expose.catalogoRev00 = {
          execucao: { ...execucao, erroSenhaMes },
          pilotoS7,
          nivelAltoHabilitado: nivelAlto.habilitado,
          rearmarRecusaPlcsim: nivelAlto.rearmarRecusaPlcsim,
          monitorS7,
          validacaoLir: dados.expose.validacaoLir,
          rotas,
          mensagemSemPendencias: dados.expose.mensagemSemPendencias,
          retomarPasta: dados.expose.retomarPasta || null
        }
      } catch (erro) {
        resultado.expose.recebimento ??= { erro: erro.message }
        resultado.expose.catalogoRev00 = { erro: erro.message }
      }
      return resultado
    }
  }
})
