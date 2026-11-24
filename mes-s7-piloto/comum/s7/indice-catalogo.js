'use strict'
const indices = new WeakMap()
// O catálogo importado é imutável durante o lote. Outra importação cria outro índice.
function indiceCatalogo(catalogo) {
  if (indices.has(catalogo)) return indices.get(catalogo)
  const blocosPorDb = new Map(), campos = new Map(), nomes = new Map()
  for (const tag of catalogo) {
    if (Number.isInteger(tag.dbNumber)) {
      if (!blocosPorDb.has(tag.dbNumber)) blocosPorDb.set(tag.dbNumber, new Set())
      blocosPorDb.get(tag.dbNumber).add(tag.block)
    }
    const chave = JSON.stringify([tag.block, tag.dbNumber, tag.name])
    if (!campos.has(chave)) campos.set(chave, [])
    campos.get(chave).push(tag)
    if (!nomes.has(tag.name)) nomes.set(tag.name, [])
    nomes.get(tag.name).push(tag)
  }
  const indice = { blocosPorDb, campos, nomes }
  indices.set(catalogo, indice)
  return indice
}
module.exports = { indiceCatalogo }
