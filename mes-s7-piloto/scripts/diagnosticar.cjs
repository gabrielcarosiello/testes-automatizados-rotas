const path = require('node:path'), fs = require('node:fs')
const { lerExecucao } = require('../comum/execucao')
const { ler } = require('../testes/transferencias/lir-rotas')
const { selecionarRotas, resumirLir } = require('../testes/transferencias/selecao-lir')
const { criarEstadoEscrita } = require('../comum/s7/estado-escrita')
const { criarClienteMonitor } = require('../comum/s7/cliente-monitor')
const { verificarApiDiagnostico } = require('../comum/s7/diagnostico-equipamentos')
async function principal() {
  const raiz = path.resolve(__dirname, '..'), config = lerExecucao(raiz), s7 = JSON.parse(fs.readFileSync(path.join(raiz, 's7.local.json'), 'utf8').replace(/^\uFEFF/, ''))
  const lir = ler(raiz, config.planilha ? path.resolve(raiz, config.planilha) : undefined)
  console.log(JSON.stringify({ versao: '11', node: process.version, planilha: path.basename(lir.arquivo), hash: lir.hash, resumo: resumirLir(lir.rotas), selecionadas: selecionarRotas(lir.rotas, { codigoRota: s7.codigoRota, testarNivelAlto: s7.nivelAlto?.habilitado, modoSelecao: config.selecaoRotas }).map(r => r.codigo), host: s7.host, monitor: s7.monitor, tipoContatoLSH: s7.tipoContatoLSH, pendencia: criarEstadoEscrita(raiz, {}).ler() }, null, 2))
  if (process.argv.includes('--monitor')) {
    const url = new URL(s7.monitor)
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password) throw new Error('Monitor deve ser uma URL HTTP local sem credenciais.')
    const chamar = criarClienteMonitor(url)
    const catalogos = await chamar('/api/tia/catalogos')
    console.log('Monitor acessível. Metadados dos catálogos: ' + JSON.stringify(catalogos))
    await verificarApiDiagnostico(chamar)
    console.log('API de diagnóstico de DBs disponível.')
  }
}
principal().catch(e => { console.error(e.message); process.exitCode = 1 })
