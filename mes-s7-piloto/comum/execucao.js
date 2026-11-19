'use strict'
const fs = require('node:fs')
const path = require('node:path')
function lerExecucao(raiz) {
  const arquivo = path.join(raiz, 'execucao.local.json')
  const valor = fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '')) : {}
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('execucao.local.json deve ser um objeto.')
  const cfg = { planilha: null, urlMes: 'http://localhost/nexxus-mes', usuarioMes: 'ADMIN', esperaBuscaMs: 0, esperaVisualS7Ms: 0, esperaMesSemS7Ms: 0, numTestsKeptInMemory: 5, capturaDesktop: true, selecaoRotas: 'pendentes', modoBusca: 'estavel', ...valor }
  for (const chave of Object.keys(valor)) if (!['planilha', 'urlMes', 'usuarioMes', 'esperaBuscaMs', 'esperaVisualS7Ms', 'esperaMesSemS7Ms', 'numTestsKeptInMemory', 'capturaDesktop', 'selecaoRotas', 'modoBusca'].includes(chave)) throw new Error(`Campo desconhecido em execucao.local.json: ${chave}`)
  for (const chave of ['esperaBuscaMs', 'esperaVisualS7Ms', 'esperaMesSemS7Ms']) if (!Number.isInteger(cfg[chave]) || cfg[chave] < 0 || cfg[chave] > 10000) throw new Error(`${chave} deve estar entre 0 e 10000 ms.`)
  if (!Number.isInteger(cfg.numTestsKeptInMemory) || cfg.numTestsKeptInMemory < 0 || cfg.numTestsKeptInMemory > 50) throw new Error('numTestsKeptInMemory deve estar entre 0 e 50.')
  if (typeof cfg.capturaDesktop !== 'boolean') throw new Error('capturaDesktop deve ser true ou false.')
  if (!['pendentes', 'todas', 'falhas', 'nao-testadas'].includes(cfg.selecaoRotas)) throw new Error('selecaoRotas inválida.')
  if (!['estavel', 'rapida'].includes(cfg.modoBusca)) throw new Error('modoBusca deve ser estavel ou rapida.')
  const url = new URL(cfg.urlMes)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('urlMes deve ser uma URL HTTP/HTTPS sem credenciais.')
  if (typeof cfg.usuarioMes !== 'string' || !cfg.usuarioMes.trim()) throw new Error('usuarioMes inválido.')
  if (cfg.planilha !== null) {
    if (typeof cfg.planilha !== 'string' || !/\.xlsx$/i.test(cfg.planilha)) throw new Error('planilha deve apontar para uma LIR .xlsx.')
    const relativo = path.relative(path.resolve(raiz, 'planilhas'), path.resolve(raiz, cfg.planilha))
    if (!relativo || relativo.startsWith('..') || path.isAbsolute(relativo)) throw new Error('A planilha ativa deve estar dentro de planilhas.')
    try {
      if (!fs.statSync(path.resolve(raiz, cfg.planilha)).isFile()) throw new Error('Não é um arquivo.')
    } catch { throw new Error(`Planilha ativa não encontrada: ${cfg.planilha}`) }
  }
  return cfg
}
module.exports = { lerExecucao }
