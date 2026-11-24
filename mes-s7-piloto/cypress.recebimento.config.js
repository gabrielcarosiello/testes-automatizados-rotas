const { defineConfig } = require('cypress')
const { lerExecucao } = require('./comum/execucao')
const { lerSenhaMes } = require('./comum/credenciais-mes')

module.exports = defineConfig({
  video: false,
  screenshotsFolder: 'resultados',
  trashAssetsBeforeRuns: false,
  e2e: {
    specPattern: 'testes/recebimentos/recebimento.js',
    supportFile: false,
    setupNodeEvents(on, config) {
      const { urlMes, usuarioMes, planilha } = lerExecucao(config.projectRoot)
      const { senha, erro } = lerSenhaMes(config.projectRoot, config.env?.senhaMES)
      if (senha) config.env = { ...config.env, senhaMES: senha }
      on('task', require('./testes/recebimentos/s7').tarefasRecebimento(config.projectRoot, planilha))
      config.expose = { ...config.expose, recebimento: { urlMes, usuarioMes, erroSenhaMes: erro } }
      return config
    },
  },
})
