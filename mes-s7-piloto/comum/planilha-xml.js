'use strict'
const XLSX = require('xlsx')
const { SaxesParser } = require('saxes')
const XML = 'http://www.w3.org/XML/1998/namespace'
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const posix = require('node:path').posix

// Leitura lexical: nunca interpretar como atributos o texto de células, comentários ou CDATA.
function tags(xml) {
  const resultado = []
  for (let i = 0; i < xml.length;) {
    const inicio = xml.indexOf('<', i)
    if (inicio < 0) break
    let marcador
    if (xml.startsWith('<!--', inicio)) marcador = '-->'
    else if (xml.startsWith('<![CDATA[', inicio)) marcador = ']]>'
    else if (xml.startsWith('<?', inicio)) marcador = '?>'
    if (marcador) { const fim = xml.indexOf(marcador, inicio + 2); if (fim < 0) throw new Error('XML incompleto.'); i = fim + marcador.length; continue }
    if (xml.startsWith('<!', inicio)) throw new Error('Declaração DTD/entidade não suportada na planilha.')
    let aspas = '', fim = inicio + 1
    for (; fim < xml.length; fim++) {
      const c = xml[fim]
      if (aspas) { if (c === aspas) aspas = '' } else if (c === '"' || c === "'") aspas = c
      else if (c === '>') break
    }
    if (fim === xml.length) throw new Error('Tag XML incompleta.')
    const raw = xml.slice(inicio, fim + 1), nome = /^<\/?([^\s/>]+)/.exec(raw)?.[1]
    if (!nome) throw new Error('Nome de tag inválido.')
    resultado.push({ inicio, fim: fim + 1, raw, nome, local: nome.split(':').at(-1), fecha: raw.startsWith('</'), unica: /\/\s*>$/.test(raw) })
    i = fim + 1
  }
  return resultado
}
function atributos(tag) {
  return [...tag.matchAll(/(\s+)([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)].map(m => ({ nome: m[2], valor: m[4] ?? m[5], inicio: m.index, fim: m.index + m[0].length, raw: m[0], espaco: m[1] }))
}
function substituirIntervalos(texto, mudancas) {
  for (const m of [...mudancas].sort((a, b) => b.inicio - a.inicio)) texto = texto.slice(0, m.inicio) + m.valor + texto.slice(m.fim)
  return texto
}
function corrigirNamespaces(xml) {
  const lista = tags(xml), declaracoes = new Map()
  for (const t of lista.filter(t => !t.fecha)) for (const a of atributos(t.raw)) if (a.nome.startsWith('xmlns:')) {
    const prefixo = a.nome.slice(6)
    if (!declaracoes.has(prefixo)) declaracoes.set(prefixo, new Set())
    declaracoes.get(prefixo).add(a.valor)
  }
  const aliases = new Set()
  for (const [prefixo, uris] of declaracoes) if (prefixo !== 'xml' && uris.has(XML)) {
    if (uris.size !== 1) throw new Error(`Prefixo ${prefixo} tem mais de um namespace: recuperação automática recusada.`)
    aliases.add(prefixo)
  }
  const mudancas = []; let declaracoesCorrigidas = 0, atributosCorrigidos = 0
  if (!aliases.size) return { xml, declaracoesCorrigidas, atributosCorrigidos }
  for (const t of lista) {
    if (t.nome.includes(':') && aliases.has(t.nome.split(':')[0])) throw new Error('Prefixo XML reservado usado em elemento; revisão manual necessária.')
    if (t.fecha) continue
    const locais = []
    for (const a of atributos(t.raw)) {
      if (a.nome.startsWith('xmlns:') && aliases.has(a.nome.slice(6))) {
        locais.push({ inicio: a.inicio, fim: a.fim, valor: '' }); declaracoesCorrigidas++
      } else if (a.nome.includes(':') && aliases.has(a.nome.split(':')[0])) {
        const nome = 'xml:' + a.nome.split(':').slice(1).join(':')
        locais.push({ inicio: a.inicio, fim: a.fim, valor: a.espaco + nome + a.raw.slice(a.espaco.length + a.nome.length) }); atributosCorrigidos++
      }
    }
    if (locais.length) mudancas.push({ inicio: t.inicio, fim: t.fim, valor: substituirIntervalos(t.raw, locais) })
  }
  return { xml: substituirIntervalos(xml, mudancas), declaracoesCorrigidas, atributosCorrigidos }
}
function validarXml(xml, parte) {
  try { new SaxesParser({ xmlns: true }).write(xml).close() } catch (e) { throw new Error(`XML inválido em ${parte}: ${e.message}`) }
}
function abrirPacote(buffer, { normalizar = true } = {}) {
  if (buffer.length > 64 * 1024 * 1024 || buffer.readUInt32LE(0) !== 0x04034b50) throw new Error('Arquivo não é um XLSX ZIP compatível ou excede 64 MiB.')
  const cfb = XLSX.CFB.read(buffer, { type: 'buffer' }), partes = new Map(), reparos = []
  let total = 0
  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const entry = cfb.FileIndex[i]
    if (entry.type !== 2) continue
    const nome = cfb.FullPaths[i].slice(cfb.FullPaths[0].length)
    if (nome.startsWith('\x01')) continue // Marcador interno de CFB, não pertence ao ZIP.
    if (partes.has(nome)) throw new Error('Parte duplicada no XLSX: ' + nome)
    total += entry.content.length
    if (total > 256 * 1024 * 1024) throw new Error('XLSX expandido excede 256 MiB.')
    partes.set(nome, entry)
    if (!/\.(xml|rels|vml)$/i.test(nome)) continue
    const raw = Buffer.from(entry.content), texto = raw.toString('utf8')
    if (!Buffer.from(texto, 'utf8').equals(raw)) throw new Error(`Codificação XML não UTF-8 em ${nome}; revisão manual necessária.`)
    const correcao = normalizar ? corrigirNamespaces(texto) : { xml: texto, declaracoesCorrigidas: 0 }
    validarXml(correcao.xml, nome)
    if (correcao.xml !== texto) {
      entry.content = Buffer.from(correcao.xml, 'utf8'); entry.size = entry.content.length
      reparos.push({ parte: nome, declaracoes: correcao.declaracoesCorrigidas, atributos: correcao.atributosCorrigidos })
    }
  }
  if (!partes.has('[Content_Types].xml') || !partes.has('xl/workbook.xml')) throw new Error('Estrutura de pasta de trabalho ausente.')
  return { cfb, partes, reparos }
}
function xmlParte(pacote, nome) {
  const parte = pacote.partes.get(nome)
  if (!parte) throw new Error('Parte ausente: ' + nome)
  return Buffer.from(parte.content).toString('utf8')
}
function definirParte(pacote, nome, xml) {
  validarXml(xml, nome)
  const entry = pacote.partes.get(nome)
  if (!entry) throw new Error('Parte ausente: ' + nome)
  entry.content = Buffer.from(xml, 'utf8'); entry.size = entry.content.length
}
function gerarZip(pacote) {
  const buffer = Buffer.from(XLSX.CFB.write(pacote.cfb, { fileType: 'zip', type: 'buffer', compression: true }))
  const validado = abrirPacote(buffer, { normalizar: false })
  if (validado.partes.size !== pacote.partes.size) throw new Error('A quantidade de partes mudou durante a gravação.')
  for (const [nome, entry] of pacote.partes) if (!Buffer.from(entry.content).equals(Buffer.from(validado.partes.get(nome)?.content || []))) throw new Error('Parte alterada durante a gravação ZIP: ' + nome)
  return buffer
}
function localizarAba(pacote, nomeAba) {
  let rid, date1904 = false
  const parser = new SaxesParser({ xmlns: true })
  parser.on('opentag', t => {
    if (t.uri !== MAIN) return
    if (t.local === 'workbookPr') date1904 = ['1', 'true'].includes(t.attributes.date1904?.value)
    if (t.local === 'sheet' && t.attributes.name?.value === nomeAba) {
      if (rid) throw new Error('Nome de aba duplicado.')
      rid = Object.values(t.attributes).find(a => a.local === 'id' && a.uri === REL)?.value
    }
  }); parser.write(xmlParte(pacote, 'xl/workbook.xml')).close()
  if (!rid) throw new Error('Aba de transferências não encontrada.')
  let target
  const rels = new SaxesParser({ xmlns: true })
  rels.on('opentag', t => {
    if (t.local === 'Relationship' && t.attributes.Id?.value === rid) {
      if (t.attributes.TargetMode?.value === 'External' || target) throw new Error('Vínculo da aba inválido ou externo.')
      target = t.attributes.Target?.value
    }
  }); rels.write(xmlParte(pacote, 'xl/_rels/workbook.xml.rels')).close()
  if (!target) throw new Error('Vínculo da aba não encontrado.')
  const parte = target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join('xl', target))
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(parte)) throw new Error('Caminho da aba inesperado.')
  xmlParte(pacote, parte)
  return { parte, date1904 }
}
function escapar(valor) {
  const limpo = [...String(valor ?? '')].filter(c => { const n = c.codePointAt(0); return n === 9 || n === 10 || n === 13 || n >= 32 && n <= 0xD7FF || n >= 0xE000 && n <= 0xFFFD || n >= 0x10000 && n <= 0x10FFFF }).join('')
  return limpo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function atributoTag(tag, nome, valor) {
  const atual = atributos(tag).find(a => a.nome === nome)
  if (atual) return substituirIntervalos(tag, [{ inicio: atual.inicio, fim: atual.fim, valor: atual.espaco + nome + '="' + valor + '"' }])
  return tag.replace(/\s*(\/?>)$/, ' ' + nome + '="' + valor + '"$1')
}
function atualizarCelulas(xml, atualizacoes) {
  const lista = tags(xml), mudancas = []
  for (const [ref, valor] of Object.entries(atualizacoes)) {
    const achados = lista.map((t, i) => ({ t, i })).filter(({ t }) => !t.fecha && t.local === 'c' && atributos(t.raw).some(a => a.nome === 'r' && a.valor === ref))
    if (achados.length !== 1) throw new Error(`Célula ${ref} ausente ou duplicada; documento não alterado.`)
    const { t, i } = achados[0]
    let fim = t.fim
    if (!t.unica) {
      let profundidade = 1, j = i + 1
      for (; j < lista.length; j++) if (lista[j].nome === t.nome) { if (lista[j].fecha) profundidade--; else if (!lista[j].unica) profundidade++; if (!profundidade) break }
      if (j === lista.length) throw new Error('Célula sem fechamento: ' + ref)
      fim = lista[j].fim
      if (lista.slice(i + 1, j).some(n => !n.fecha && n.local === 'f')) throw new Error(`A célula ${ref} contém fórmula; substituição automática recusada para preservar calcChain.`)
    }
    const prefixo = t.nome.includes(':') ? t.nome.split(':')[0] + ':' : ''
    const abertura = atributoTag(t.raw.replace(/\/\s*>$/, '>'), 't', typeof valor === 'number' ? 'n' : 'inlineStr')
    const conteudo = typeof valor === 'number' ? `<${prefixo}v>${valor}</${prefixo}v>` : `<${prefixo}is><${prefixo}t xml:space="preserve">${escapar(valor)}</${prefixo}t></${prefixo}is>`
    mudancas.push({ inicio: t.inicio, fim, valor: abertura + conteudo + `</${t.nome}>` })
  }
  const saida = substituirIntervalos(xml, mudancas); validarXml(saida, 'aba atualizada'); return saida
}
module.exports = { abrirPacote, xmlParte, definirParte, gerarZip, localizarAba, atualizarCelulas, corrigirNamespaces, validarXml, tags, atributoTag }
