const pesoPadraoKg = 1000

function carregarCenarios(cenarios) {
  if (!Array.isArray(cenarios) || !cenarios.length) throw new Error('Cadastre ao menos um cenário de ordem de recebimento.')
  const ids = new Set()
  return cenarios.map(({ id, codigoProduto, nomeProduto, pesoTotalNfKg = pesoPadraoKg }) => {
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id) || ids.has(id)) throw new Error('Identificador de cenário inválido ou duplicado: ' + id)
    if (typeof codigoProduto !== 'string' || !codigoProduto.trim() || typeof nomeProduto !== 'string' || !nomeProduto.trim()) {
      throw new Error('Informe código e nome do produto no cenário ' + id + '.')
    }
    if (!Number.isFinite(pesoTotalNfKg) || pesoTotalNfKg <= 0) throw new Error('Peso total inválido no cenário ' + id + '.')
    ids.add(id)
    return { id, codigoProduto: codigoProduto.trim(), nomeProduto: nomeProduto.trim(), pesoTotalNfKg }
  })
}

module.exports = { carregarCenarios }
