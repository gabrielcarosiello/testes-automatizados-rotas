const { openAsBlob } = require('node:fs')
const path = require('node:path')

function criarCatalogoProjeto(raiz, local, chamar) {
  const fonte = local.fonteCatalogo ?? 'automatico'
  if (!['automatico', 'monitor', 'arquivo'].includes(fonte)) throw new Error('fonteCatalogo deve ser automatico, monitor ou arquivo em s7.local.json.')
  const id = local.catalogoId
  if (id !== undefined && id !== null && (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,120}$/.test(id))) throw new Error('catalogoId inválido em s7.local.json.')
  if (id && fonte === 'arquivo') throw new Error('catalogoId exige fonteCatalogo monitor ou automatico.')
  let carregado
  async function obter() {
    if (carregado) return carregado
    let dados, origem
    if (fonte !== 'arquivo') {
      try {
        dados = id ? await chamar('/api/tia/selecionar', { body: JSON.stringify({ id }), timeout: 30000 })
          : await chamar('/api/tia/catalogo', { timeout: 30000 })
      } catch (erro) {
        if (fonte !== 'automatico' || id || erro.status !== 404) throw erro
      }
      if (dados?.catalogo && (!Array.isArray(dados.arrays) || !dados.arrays.length)) throw new Error('Catálogo salvo inválido. Reimporte o projeto no Monitor.')
      if (id && dados?.catalogo?.id !== id) throw new Error('O Monitor não confirmou o catalogoId configurado.')
      if (dados?.arrays?.length) origem = 'monitor'
      else if (fonte === 'monitor' || id) throw new Error('Nenhum catálogo salvo ativo no Monitor. Importe/abra a versão do projeto antes de executar o Piloto.')
    }
    if (!origem) {
      if (typeof local.peData !== 'string' || path.basename(local.peData).toLowerCase() !== 'pedata.plf') throw new Error('Não há catálogo ativo. Configure peData ou importe a pasta do projeto no Monitor.')
      dados = await chamar('/api/tia/importar', { body: await openAsBlob(path.resolve(raiz, local.peData)), contentType: 'application/octet-stream', timeout: 90000 })
      origem = 'arquivo'
    }
    if (!Array.isArray(dados.arrays) || !dados.arrays.length || !dados.arrays.every(t => t && typeof t.block === 'string' && typeof t.name === 'string' && typeof t.type === 'string')) throw new Error('O Monitor retornou catálogo de declarações inválido.')
    carregado = { arrays: dados.arrays, info: { origem, catalogo: dados.catalogo || null, reutilizado: origem === 'monitor' || dados.cached === true } }
    return carregado
  }
  return { obter, reiniciar() { carregado = undefined } }
}
function conferirSinaisLir(rotas, arrays) {
  const porNome = new Map()
  for (const t of arrays) {
    if (t.io !== true || t.area !== 'I' || t.type.toUpperCase() !== 'BOOL' || !/^I\d+\.[0-7]$/.test(t.address || '')) continue
    const lista = porNome.get(t.name) || []
    lista.push(t); porNome.set(t.name, lista)
  }
  return rotas.filter(r => r.nivelAlto?.aplicavel).map(rota => {
    const correspondentes = porNome.get(rota.nivelAlto.io) || []
    return { codigoRota: rota.codigo, sinal: rota.nivelAlto.io, idDigital: rota.nivelAlto.idDigital,
      statusLir: rota.nivelAlto.status, address: correspondentes.length === 1 ? correspondentes[0].address : null,
      situacao: correspondentes.length === 1 ? 'localizado' : correspondentes.length ? 'ambíguo' : 'não localizado', ensaioExecutado: false }
  })
}
module.exports = { criarCatalogoProjeto, conferirSinaisLir }
