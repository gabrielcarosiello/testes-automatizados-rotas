const fs = require('fs')
const path = require('path')
const { defineConfig } = require('cypress')
const { ler, registrar, mensagemSemPendencias } = require('./lir-rotas')
const { selecionarRotas, resumirLir, conferirRotaAtual } = require('./selecao-lir')
const { gravarEvento, classificarFalha } = require('../../comum/registro-execucao')
const original = { e2e: { setupNodeEvents: (_on, config) => config } }

module.exports = defineConfig({
  e2e: {
    testIsolation: false,
    specPattern: 'testes/transferencias/transferencias.cy.js',
    setupNodeEvents(on, config, opcoes = {}) {
      // Os testes precisam existir antes de a execução começar.
      const lir = ler(config.projectRoot, opcoes.planilha ? path.resolve(config.projectRoot, opcoes.planilha) : undefined)
      const nivel = lir.rotas.filter(r => r.nivelAlto.aplicavel && ['NT', 'NOK'].includes(r.nivelAlto.status))
      if (nivel.length) console.log(`[LIR] ${nivel.length} testes de nível alto pendentes. Etapa automática conforme nivelAlto.habilitado no s7.local.json.`)
      const rotas = selecionarRotas(lir.rotas, opcoes)
      const autorizadas = new Map(rotas.map(rota => [String(rota.codigo), rota]))
      const resumo = resumirLir(lir.rotas)
      console.log(`[LIR] ${path.basename(lir.arquivo)}: ${resumo.total} rotas; Teste OK=${resumo.teste.OK}, NT=${resumo.teste.NT}, NOK=${resumo.teste.NOK}.`)
      for (const rota of rotas.filter(r => r.tipoExecucao === 'reteste')) console.log(`[LIR] Rota ${rota.codigo}: reteste normal explícito; Teste=${rota.status}, Nível Alto=${rota.nivelAlto.status || 'não informado'}.`)
      const retomar = process.env.CYPRESS_RETOMAR_PASTA || config.env.retomarPasta
      config.expose = config.expose || {}
      if (retomar) {
        if (typeof retomar !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(retomar)) throw new Error('Nome da pasta de retomada inválido')
        config.expose.retomarPasta = retomar
      }
      // Executa todas as linhas pendentes, independentemente do local.
      config.expose.rotas = rotas
      config.expose.validacaoLir = { arquivo: path.basename(lir.arquivo), hash: lir.hash, ...resumo }
      const mensagem = rotas.length ? null : mensagemSemPendencias(lir.rotas)
      if (mensagem) {
        console.log(`[LIR] ${path.basename(lir.arquivo)}: ${mensagem}`)
        config.expose.mensagemSemPendencias = mensagem
      }
      const resultado = original.e2e.setupNodeEvents(on, config) || config
      on('task', {
        validarRotaLir(codigo) {
          const inicial = autorizadas.get(String(codigo))
          conferirRotaAtual(ler(config.projectRoot, lir.arquivo).rotas, inicial)
          return { codigo: inicial.codigo, tipoExecucao: inicial.tipoExecucao, statusInicial: inicial.status }
        },
        registrarEtapa({ pasta, codigo, etapa }) {
          if (!autorizadas.has(String(codigo)) || typeof etapa !== 'string' || etapa.length > 300) throw new Error('Etapa ou rota inválida.')
          gravarEvento(config.projectRoot, pasta, 'etapa', { codigo, etapa })
          return null
        },
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
          XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['Data e hora', 'Código', 'Local', 'Transferência', 'Rota', 'Origem', 'Destino', 'Resultado', 'Etapa', 'Detalhes', 'Login e acesso (s)', 'Aguardar card (s)', 'Aguardar campo (s)', 'Iniciar (s)', 'Parada (s)', 'Iniciar até parada (s)', 'Teste da rota completo (s)', 'Execução acumulada (s)', 'Captura', 'Modalidade', 'Teste anterior', 'Resultado normal', 'Resultado nível alto']]), 'Resultados')
          XLSX.writeFile(livro, path.join(raiz, pasta, 'historico-rev00.xlsx'))
          gravarEvento(config.projectRoot, pasta, 'inicio', { piloto: '11', node: process.version, planilha: path.basename(lir.arquivo), hash: lir.hash, rotas: rotas.map(r => r.codigo) })
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
          const inicial = autorizadas.get(String(dados.codigo))
          if (!inicial) throw new Error('Rota não selecionada nesta execução')
          const idResultado = gravarEvento(config.projectRoot, dados.pasta, 'resultado-recebido', { ...dados, categoria: classificarFalha(dados) })
          const arquivo = path.join(pasta, 'historico-rev00.xlsx')
          const cabecalhos = ['Data e hora', 'Código', 'Local', 'Transferência', 'Rota', 'Origem', 'Destino', 'Resultado', 'Etapa', 'Detalhes', 'Login e acesso (s)', 'Aguardar card (s)', 'Aguardar campo (s)', 'Iniciar (s)', 'Parada (s)', 'Iniciar até parada (s)', 'Teste da rota completo (s)', 'Execução acumulada (s)', 'Captura', 'Modalidade', 'Teste anterior', 'Resultado normal', 'Resultado nível alto']
          const chaves = ['data', 'codigo', 'local', 'nome', 'rota', 'origem', 'destino', 'resultado', 'etapa', 'detalhes', 'loginSeg', 'cardSeg', 'campoSeg', 'inicio', 'parada', 'total', 'rotaCompleta', 'execucaoAteAgora', 'captura', 'tipoExecucao', 'statusInicial', 'resultadoNormal', 'resultadoNivelAlto']
          const livro = fs.existsSync(arquivo) ? XLSX.readFile(arquivo) : XLSX.utils.book_new()
          let aba = livro.Sheets.Resultados
          if (!aba) { aba = XLSX.utils.aoa_to_sheet([cabecalhos]); XLSX.utils.book_append_sheet(livro, aba, 'Resultados') }
          XLSX.utils.sheet_add_aoa(aba, [cabecalhos], { origin: 0 })
          XLSX.utils.sheet_add_aoa(aba, [chaves.map(k => dados[k] ?? '')], { origin: -1 })
          XLSX.writeFile(livro, arquivo)
          const atualizadas = registrar(config.projectRoot, dados, lir.arquivo, { rotaInicial: inicial, permitirNivelAlto: opcoes.testarNivelAlto === true })
          // A seleção explícita pode ser reexecutada no runner após uma gravação
          // feita por esta própria execução, sem reabrir o serviço Cypress.
          { // Atualiza apenas a autorização da rota gravada por esta execução.
            const gravada = atualizadas.find(r => String(r.codigo) === String(inicial.codigo))
            autorizadas.set(String(inicial.codigo), { ...gravada, statusInicial: gravada.status, tipoExecucao: gravada.status === 'OK' ? 'reteste' : 'pendente' })
          }
          const mensagem = mensagemSemPendencias(atualizadas)
          if (mensagem) console.log(`[LIR] ${path.basename(lir.arquivo)}: ${mensagem}`)
          gravarEvento(config.projectRoot, dados.pasta, 'resultado-persistido', { codigo: dados.codigo, idResultado, gravacaoLir: atualizadas.gravacaoLir })
          return { aviso: '' }
          } catch (erro) {
            console.error('Falha ao registrar resultado da rota ' + (dados && dados.codigo) + ':', erro)
            try { gravarEvento(config.projectRoot, dados.pasta, 'falha-persistencia', { codigo: dados.codigo, erro: erro.message }) } catch {}
            return { aviso: 'Resultado não foi salvo completamente: ' + erro.message + '. Confira o histórico e feche a planilha real na pasta planilhas.' }
          }
        }
      })
      return resultado
    }
  }
})
