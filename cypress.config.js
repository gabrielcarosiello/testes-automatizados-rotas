const fs = require('fs')
const path = require('path')
const { defineConfig } = require('cypress')
const base = require('./cypress.base.config')

module.exports = defineConfig({
  ...base,
  e2e: {
    ...base.e2e,
    testIsolation: false,
    supportFile: false,
    specPattern: 'testes/**/*.cy.js',
    setupNodeEvents(on, config) {
      const resultado = base.e2e.setupNodeEvents(on, config) || config
      const caminhoCredenciais = path.join(config.projectRoot, 'credenciais.local.json')
      if (fs.existsSync(caminhoCredenciais)) {
        const credenciais = JSON.parse(fs.readFileSync(caminhoCredenciais, 'utf8').replace(/^\uFEFF/, ''))
        if (typeof credenciais.senhaMES !== 'string' || !credenciais.senhaMES) throw new Error('Preencha senhaMES em credenciais.local.json')
        resultado.env = { ...resultado.env, senhaMES: resultado.env?.senhaMES || credenciais.senhaMES }
      }
      if (!String(config.specPattern || '').includes('testes')) return resultado
      resultado.expose = resultado.expose || {}
      try {
        const auxiliar = require('./testes/transferencias/config')
        const isolada = { ...resultado, env: { ...resultado.env }, expose: {} }
        const dados = auxiliar.e2e.setupNodeEvents(on, isolada) || isolada
        resultado.expose.catalogoRev00 = {
          rotas: dados.expose.rotas,
          retomarPasta: dados.expose.retomarPasta || null
        }
      } catch (erro) {
        resultado.expose.catalogoRev00 = { erro: erro.message }
      }
      return resultado
    }
  }
})
