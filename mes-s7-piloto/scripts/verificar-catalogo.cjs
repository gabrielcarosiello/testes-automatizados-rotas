const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url'), { performance } = require('node:perf_hooks')
const { lerExecucao } = require('../comum/execucao'), { ler } = require('../testes/transferencias/lir-rotas')
const { configuracaoNivel, resolverAlarme } = require('../comum/s7/nivel-alto')
const { conferirSinaisLir } = require('../comum/s7/catalogo-projeto'), { indiceCatalogo } = require('../comum/s7/indice-catalogo')
async function principal() {
  const raiz = path.resolve(__dirname, '..'), local = JSON.parse(fs.readFileSync(path.join(raiz, 's7.local.json'), 'utf8')), cfg = lerExecucao(raiz)
  const { importTiaDatabase } = await import(pathToFileURL(path.resolve(raiz, '../monitor-s7/tia-import.mjs')).href)
  const inicio = performance.now(), arrays = await importTiaDatabase(fs.createReadStream(path.resolve(raiz, local.peData))), importacaoMs = performance.now() - inicio
  const lir = ler(raiz, cfg.planilha ? path.resolve(raiz, cfg.planilha) : undefined), nivel = configuracaoNivel(local)
  const sinais = conferirSinaisLir(lir.rotas, arrays), erros = sinais.filter(s => !s.address).map(s => `${s.sinal}: ${s.situacao}`)
  // Comparação isolada: reconstruir blocos por DB para cada equipamento (comportamento anterior)
  // versus construir uma vez e consultar o mesmo catálogo imutável (Piloto 11).
  const repeticoes = 50, db = arrays.find(t => Number.isInteger(t.dbNumber)).dbNumber
  const antes = performance.now()
  for (let i = 0; i < repeticoes; i++) {
    const blocos = new Map()
    for (const tag of arrays) if (Number.isInteger(tag.dbNumber)) { if (!blocos.has(tag.dbNumber)) blocos.set(tag.dbNumber, new Set()); blocos.get(tag.dbNumber).add(tag.block) }
    if (!blocos.get(db)?.size) throw new Error('Resultado de referência inválido.')
  }
  const antesMs = performance.now() - antes, novo = performance.now(), indice = indiceCatalogo(arrays)
  for (let i = 0; i < repeticoes; i++) if (!indice.blocosPorDb.get(db)?.size) throw new Error('Resultado indexado inválido.')
  const depoisMs = performance.now() - novo
  const aquecido = performance.now()
  for (let i = 0; i < repeticoes; i++) if (!indiceCatalogo(arrays).blocosPorDb.get(db)?.size) throw new Error('Consulta aquecida inválida.')
  const aquecidoMs = performance.now() - aquecido
  for (const rota of lir.rotas) try { resolverAlarme(rota, arrays, nivel) } catch (e) { erros.push(`${rota.codigo}: ${e.message}`) }
  const relatorio = { declaracoes: arrays.length, rotas: lir.rotas.length, sinaisLir: sinais.length, importacaoMs, comparacaoIndice: { repeticoes, antesMs, depoisMs, aquecidoMs, incluiConstrucaoDoIndice: true }, erros, bancada: 'Leitura offline do PEData fornecido. Nenhum acesso ao CLP, MES ou SQL.' }
  console.log(JSON.stringify(relatorio, null, 2))
  if (process.argv.includes('--salvar')) fs.writeFileSync(path.resolve(raiz, '../RELATORIO_CATALOGO_REAL.json'), JSON.stringify(relatorio, null, 2))
  if (erros.length) process.exitCode = 1
}
principal().catch(e => { console.error(e.stack); process.exitCode = 1 })
