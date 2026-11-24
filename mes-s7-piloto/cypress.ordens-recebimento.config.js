const { defineConfig } = require('cypress')
const { lerExecucao } = require('./comum/execucao')
const { lerSenhaMes } = require('./comum/credenciais-mes')

module.exports = defineConfig({
  video: false,
  trashAssetsBeforeRuns: false,
  screenshotsFolder: 'resultados/ordens-recebimento',
  e2e: {
    specPattern: 'testes/ordens-recebimento/*.ordem.js',
    supportFile: false,
    setupNodeEvents(_, config) {
      const { urlMes, usuarioMes } = lerExecucao(config.projectRoot)
      const { senha, erro } = lerSenhaMes(config.projectRoot, config.env?.senhaMES)
      if (senha) config.env = { ...config.env, senhaMES: senha }
      config.expose = { ...config.expose, criacaoOrdem: { urlMes, usuarioMes, erroSenhaMes: erro } }
      return config
    },
  },
})
