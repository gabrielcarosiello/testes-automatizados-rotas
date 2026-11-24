const { defineConfig } = require('cypress')
const { lerExecucao } = require('./comum/execucao')
const { lerSenhaMes } = require('./comum/credenciais-mes')

module.exports = defineConfig({
  video: false,
  trashAssetsBeforeRuns: false,
  screenshotsFolder: 'resultados',
  e2e: {
    specPattern: 'testes/ordens-recebimento/*.ordem.js',
    supportFile: false,
    setupNodeEvents(on, config) {
      const { urlMes, usuarioMes } = lerExecucao(config.projectRoot)
      const { senha, erro } = lerSenhaMes(config.projectRoot, config.env?.senhaMES)
      if (senha) config.env = { ...config.env, senhaMES: senha }
      on('task', require('./testes/ordens-recebimento/evidencias').tarefasEvidenciasOrdem(config.projectRoot, senha))
      config.expose = { ...config.expose, criacaoOrdem: { urlMes, usuarioMes, erroSenhaMes: erro } }
      return config
    },
  },
})
