const { indiceCatalogo } = require('./indice-catalogo')
function consultarDbsDaRota(linhaCsv, catalogo, blocosPorPonto = {}) {
  const [, , codigoRota, rota, origem, destino] =
    linhaCsv.trim().split(';').map((campo) => campo.trim())

  if (!codigoRota || !rota || !origem || !destino) {
    throw new Error('Informe uma linha CSV com código, rota, origem e destino.')
  }

  const pontos = rota.split('->').map((ponto) => ponto.trim().toUpperCase())

  if (
    pontos.some((ponto) => !ponto) ||
    pontos[0] !== origem.toUpperCase() ||
    pontos.at(-1) !== destino.toUpperCase()
  ) {
    throw new Error(`A sequência da rota ${codigoRota} está inconsistente.`)
  }

  if (!Array.isArray(catalogo)) {
    throw new Error('A importação não retornou um catálogo de DBs válido.')
  }

  const blocos = new Map()

  for (const tag of catalogo) {
    if (typeof tag?.block !== 'string' || !tag.block.trim()) continue
    if (!blocos.has(tag.block)) blocos.set(tag.block, new Set())
    if (Number.isInteger(tag.dbNumber) && tag.dbNumber > 0) {
      blocos.get(tag.block).add(tag.dbNumber)
    }
  }

  return pontos.map((ponto, indice) => {
    const candidatos = [...blocos]
      .filter(([bloco]) => bloco.toUpperCase().endsWith(`_${ponto}`))
      .map(([bloco, numeros]) => ({
        bloco,
        db: numeros.size === 1 ? [...numeros][0] : null,
      }))

    const equipamentos = candidatos.filter(({ bloco }) =>
      /^EQP\d+_/i.test(bloco)
    )

    const blocoConfigurado = blocosPorPonto[ponto]
    const encontrado = blocoConfigurado
      ? candidatos.find(({ bloco }) => bloco.toUpperCase() === blocoConfigurado.toUpperCase())
      : equipamentos.length === 1 ? equipamentos[0] : null

    return {
      rota: codigoRota,
      ordem: indice + 1,
      ponto,
      status: encontrado?.db ? 'resolvido' : 'pendente',
      bloco: encontrado?.bloco ?? null,
      db: encontrado?.db ?? null,
      candidatos,
    }
  })
}

function consultarDbsDaRotaSql(vinculos, catalogo) {
  const { blocosPorDb } = indiceCatalogo(catalogo)

  return vinculos.map((vinculo) => {
    const { des_tag: ponto, espelhos_entrada: entradas } = vinculo
    const enderecos = entradas.map((entrada) => /^DB(\d+),X\d+\.[0-7]$/i.exec(entrada))
    if (enderecos.some((entrada) => !entrada) || enderecos[0][1] !== enderecos[1][1]) {
      throw new Error(`DB divergente ou inválido nos espelhos de entrada de ${ponto}.`)
    }
    const db = Number(enderecos[0][1])
    const candidatos = blocosPorDb.get(db) ?? new Set()
    const bloco = candidatos.size === 1 ? [...candidatos][0] : null
    return { ...vinculo, ponto, db, bloco, status: bloco ? 'resolvido' : 'pendente' }
  })
}

module.exports = { consultarDbsDaRota, consultarDbsDaRotaSql }
