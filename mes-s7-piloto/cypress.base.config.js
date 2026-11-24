const { defineConfig } = require('cypress')
const { execFile } = require('child_process')
const path = require('path')
const fs = require('fs')

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        capturarTelas({ nome, pastaExecucao }) {
          if (typeof nome !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(nome)) throw new Error('Nome de captura inválido')
          if (typeof pastaExecucao !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(pastaExecucao)) throw new Error('Pasta de execução inválida')
          const pasta = path.join(config.projectRoot, 'resultados', pastaExecucao)
          if (!fs.existsSync(pasta)) throw new Error('Pasta da execução não encontrada')
          const arquivo = path.join(pasta, `${nome}.png`)
          const script = path.join(config.projectRoot, 'comum', 'capturar-telas.ps1')
          return new Promise((resolve, reject) => {
            execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Arquivo', arquivo], { windowsHide: true }, (erro, stdout, stderr) => {
              if (erro) return reject(new Error(`Falha na captura: ${stderr || erro.message}`))
              resolve(arquivo)
            })
          })
        }
      })
      return config
    }
  }
})
