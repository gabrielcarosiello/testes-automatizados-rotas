const fs = require('fs')
const path = require('path')
const { defineConfig } = require('cypress')
const { ler, registrar } = require('./lir-rotas')
const original = { e2e: { setupNodeEvents: (_on, config) => config } }

module.exports = defineConfig({
  e2e: {
    testIsolation: false,
    specPattern: 'testes/transferencias/transferencias.cy.js',
    setupNodeEvents(on, config) {
      // Os testes precisam existir antes de a execução começar.
      const rotas = ler(config.projectRoot).rotas.filter(r => r.status === 'NT' || r.status === 'NOK')
      const retomar = process.env.CYPRESS_RETOMAR_PASTA || config.env.retomarPasta
      config.expose = config.expose || {}
      if (retomar) {
        if (typeof retomar !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(retomar)) throw new Error('Nome da pasta de retomada inválido')
        config.expose.retomarPasta = retomar
      }
      // Executa todas as linhas pendentes, independentemente do local.
      config.expose.rotas = rotas
      const resultado = original.e2e.setupNodeEvents(on, config) || config
      on('task', {
        iniciarRev00() {
          const XLSX = require('xlsx')
          const agora = new Date()
          const local = [agora.getFullYear(), String(agora.getMonth()+1).padStart(2,'0'), String(agora.getDate()).padStart(2,'0'), String(agora.getHours()).padStart(2,'0'), String(agora.getMinutes()).padStart(2,'0'), String(agora.getSeconds()).padStart(2,'0'), String(agora.getMilliseconds()).padStart(3,'0')].join('-')
          const raiz = path.join(config.projectRoot, 'resultados')
          fs.mkdirSync(raiz, { recursive: true })
          let pasta = `Teste_rotas_Rev00_${local}`
          for (let i = 1; ; i++) {
            try { fs.mkdirSync(path.join(raiz, pasta)); break } catch (e) { if (e.code !== 'EEXIST') throw e; pasta = `Teste_rotas_Rev00_${local}_${i}` }
          }
          const livro = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['Data e hora', 'Código', 'Local', 'Transferência', 'Rota', 'Origem', 'Destino', 'Resultado', 'Etapa', 'Detalhes', 'Login e acesso (s)', 'Aguardar card (s)', 'Aguardar campo (s)', 'Iniciar (s)', 'Parada (s)', 'Iniciar até parada (s)', 'Teste da rota completo (s)', 'Execução acumulada (s)', 'Captura']]), 'Resultados')
          XLSX.writeFile(livro, path.join(raiz, pasta, 'historico-rev00.xlsx'))
          return pasta
        },
        retomarRev00(pasta) {
          if (typeof pasta !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(pasta)) throw new Error('Pasta de retomada inválida')
          const arquivo = path.join(config.projectRoot, 'resultados', pasta, 'historico-rev00.xlsx')
          if (!fs.statSync(arquivo).isFile()) throw new Error('Planilha de retomada não encontrada')
          return pasta
        },
        registrarRev00(dados) {
          try {
          const XLSX = require('xlsx')
          if (!/^[a-zA-Z0-9_-]+$/.test(dados.pasta || '')) throw new Error('Pasta de execução inválida')
          const pasta = path.join(config.projectRoot, 'resultados', dados.pasta)
          if (!fs.statSync(pasta).isDirectory()) throw new Error('Pasta de execução inexistente')
          const arquivo = path.join(pasta, 'historico-rev00.xlsx')
          const cabecalhos = ['Data e hora', 'Código', 'Local', 'Transferência', 'Rota', 'Origem', 'Destino', 'Resultado', 'Etapa', 'Detalhes', 'Login e acesso (s)', 'Aguardar card (s)', 'Aguardar campo (s)', 'Iniciar (s)', 'Parada (s)', 'Iniciar até parada (s)', 'Teste da rota completo (s)', 'Execução acumulada (s)', 'Captura']
          const chaves = ['data', 'codigo', 'local', 'nome', 'rota', 'origem', 'destino', 'resultado', 'etapa', 'detalhes', 'loginSeg', 'cardSeg', 'campoSeg', 'inicio', 'parada', 'total', 'rotaCompleta', 'execucaoAteAgora', 'captura']
          const livro = fs.existsSync(arquivo) ? XLSX.readFile(arquivo) : XLSX.utils.book_new()
          let aba = livro.Sheets.Resultados
          if (!aba) { aba = XLSX.utils.aoa_to_sheet([cabecalhos]); XLSX.utils.book_append_sheet(livro, aba, 'Resultados') }
          XLSX.utils.sheet_add_aoa(aba, [chaves.map(k => dados[k] ?? '')], { origin: -1 })
          XLSX.writeFile(livro, arquivo)
          registrar(config.projectRoot, dados)
          return { aviso: '' }
          } catch (erro) {
            console.error('Falha ao registrar resultado da rota ' + (dados && dados.codigo) + ':', erro)
            return { aviso: 'Resultado não foi salvo completamente: ' + erro.message + '. Confira o histórico e feche a planilha real na pasta planilhas.' }
          }
        }
      })
      return resultado
    }
  }
})
