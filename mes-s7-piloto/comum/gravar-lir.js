'use strict'
const fs = require('node:fs'), path = require('node:path'), { createHash, randomUUID } = require('node:crypto')
const { abrirPacote, xmlParte, definirParte, gerarZip, localizarAba, atualizarCelulas, tags, atributoTag } = require('./planilha-xml')
const hash = buffer => createHash('sha256').update(buffer).digest('hex')
function verificarExcelFechado(arquivo) {
  const dir = path.dirname(arquivo), nome = path.basename(arquivo)
  if ([path.join(dir, '~$' + nome), path.join(dir, '.~lock.' + nome + '#')].some(p => fs.existsSync(p))) throw new Error('Feche Excel/LibreOffice antes de gravar a LIR; arquivo de bloqueio encontrado.')
}
function gravarArquivoSincronizado(arquivo, dados, flags = 'wx') {
  const fd = fs.openSync(arquivo, flags)
  try { fs.writeFileSync(fd, dados); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
function serialData(agora, date1904) {
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())
  return (hoje - Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30)) / 86400000
}
function solicitarRecalculo(pacote) {
  const workbook = xmlParte(pacote, 'xl/workbook.xml'), calc = tags(workbook).filter(t => !t.fecha && t.local === 'calcPr')
  if (calc.length > 1) throw new Error('Propriedades de cálculo duplicadas.')
  if (calc.length === 1) {
    const t = calc[0], novo = atributoTag(atributoTag(t.raw, 'fullCalcOnLoad', '1'), 'forceFullCalc', '1')
    definirParte(pacote, 'xl/workbook.xml', workbook.slice(0, t.inicio) + novo + workbook.slice(t.fim))
  }
  return calc.length === 1
}
function atualizarLir(info, { agora = () => new Date(), renomear = fs.renameSync } = {}) {
  if (!Number.isInteger(info.linha) || info.linha < 9 || info.linha > 1048576 || !['OK', 'NOK'].includes(info.teste)) throw new Error('Dados da atualização da LIR inválidos.')
  if (info.nivelAlto !== undefined && !['OK', 'NOK', '---'].includes(info.nivelAlto)) throw new Error('Resultado de nível alto inválido.')
  const nomes = ['Teste', 'Data', 'Falha Identificada', ...(info.nivelAlto !== undefined ? ['Nível Alto'] : [])]
  const colunas = nomes.map(n => info.colunas?.[n])
  const numeroColuna = col => [...col].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
  if (colunas.some(c => typeof c !== 'string' || !/^[A-Z]{1,3}$/.test(c) || numeroColuna(c) > 16384) || new Set(colunas).size !== colunas.length) throw new Error('Colunas da atualização inválidas.')
  return gravarAlteracoesLir(info, aba => {
    const atualizacoes = { [info.colunas.Teste + info.linha]: info.teste,
      [info.colunas.Data + info.linha]: serialData(agora(), aba.date1904),
      [info.colunas['Falha Identificada'] + info.linha]: String(info.falha || '').slice(0, 30000) }
    if (info.nivelAlto !== undefined) atualizacoes[info.colunas['Nível Alto'] + info.linha] = info.nivelAlto
    return atualizacoes
  }, renomear)
}

function marcarNivelAltoNaoAplicavel(info) {
  const { coluna, linhas } = info
  const numero = typeof coluna === 'string' ? [...coluna].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) : 0
  if (!/^[A-Z]{1,3}$/.test(coluna ?? '') || numero > 16384 || !Array.isArray(linhas) || !linhas.length ||
      linhas.some(l => !Number.isInteger(l) || l < 9 || l > 1048576)) throw new Error('Células de nível alto inválidas.')
  return gravarAlteracoesLir(info, () => Object.fromEntries(linhas.map(l => [coluna + l, '---'])), fs.renameSync)
}

function gravarAlteracoesLir(info, montarAtualizacoes, renomear) {
  const arquivo = path.resolve(info.arquivo), lock = arquivo + '.gravacao.lock', tmp = arquivo + '.atualizacao-' + randomUUID() + '.tmp'
  verificarExcelFechado(arquivo)
  const original = fs.readFileSync(arquivo)
  if (hash(original) !== info.hash) throw new Error('A planilha mudou desde a leitura; resultado não sobrescrito.')
  const token = randomUUID(); let possuiLock = false
  try {
    try { gravarArquivoSincronizado(lock, token); possuiLock = true } catch (e) { if (e.code === 'EEXIST') throw new Error('Existe gravação de LIR pendente. Feche os testes e confira o arquivo .gravacao.lock antes de tentar novamente.'); throw e }
    const pacote = abrirPacote(original), aba = localizarAba(pacote, 'Lista de Rotas - Transferências')
    const atualizacoes = montarAtualizacoes(aba)
    definirParte(pacote, aba.parte, atualizarCelulas(xmlParte(pacote, aba.parte), atualizacoes))
    solicitarRecalculo(pacote)
    const saida = gerarZip(pacote) // Reabre ZIP e valida todo XML antes de tocar o original.
    const dirBackup = path.resolve(info.backupDir || path.join(path.dirname(arquivo), 'backups-lir'))
    fs.mkdirSync(dirBackup, { recursive: true })
    const stem = path.basename(arquivo, '.xlsx'), inicial = path.join(dirBackup, stem + '.inicio.xlsx'), anterior = path.join(dirBackup, stem + '.anterior.xlsx')
    try { gravarArquivoSincronizado(inicial, original) } catch (e) { if (e.code !== 'EEXIST') throw e }
    const backupTmp = anterior + '.' + token + '.tmp'
    try { gravarArquivoSincronizado(backupTmp, original); fs.renameSync(backupTmp, anterior) } finally { if (fs.existsSync(backupTmp)) fs.unlinkSync(backupTmp) }
    gravarArquivoSincronizado(tmp, saida)
    // Checar novamente depois da preparação e nunca apagar o original antes do rename.
    verificarExcelFechado(arquivo)
    if (hash(fs.readFileSync(arquivo)) !== info.hash) throw new Error('A planilha mudou durante a atualização; arquivo original preservado.')
    renomear(tmp, arquivo)
    return { arquivo, parte: aba.parte, celulas: Object.keys(atualizacoes), reparosNamespace: pacote.reparos, backups: { inicial, anterior } }
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
    if (possuiLock && fs.existsSync(lock) && fs.readFileSync(lock, 'utf8') === token) fs.unlinkSync(lock)
  }
}
function recuperarCopia(arquivo, destino) {
  const original = fs.readFileSync(arquivo), pacote = abrirPacote(original)
  const recalculoSolicitado = solicitarRecalculo(pacote), saida = gerarZip(pacote)
  if (path.resolve(arquivo) === path.resolve(destino)) throw new Error('A recuperação deve criar outra cópia, sem sobrescrever o original.')
  fs.mkdirSync(path.dirname(path.resolve(destino)), { recursive: true })
  gravarArquivoSincronizado(destino, saida)
  return { origem: path.resolve(arquivo), copia: path.resolve(destino), reparos: pacote.reparos, recalculoSolicitado, originalPreservado: hash(fs.readFileSync(arquivo)) === hash(original) }
}
module.exports = { atualizarLir, marcarNivelAltoNaoAplicavel, recuperarCopia, serialData, verificarExcelFechado }
