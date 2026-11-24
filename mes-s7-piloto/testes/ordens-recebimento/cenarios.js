const pesoPadraoKg = 1000

function carregarCenarios(cenarios, { ensacados = false } = {}) {
  if (!Array.isArray(cenarios) || !cenarios.length) throw new Error('Cadastre ao menos um cenário de ordem de recebimento.')
  const ids = new Set()
  return cenarios.map(({ id, codigoProduto, nomeProduto, pesoTotalNfKg = pesoPadraoKg, quantidade, pesoUnitarioKg, fornecedor, validadeDias = 180 }) => {
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id) || ids.has(id)) throw new Error('Identificador de cenário inválido ou duplicado: ' + id)
    if (typeof codigoProduto !== 'string' || !codigoProduto.trim() || typeof nomeProduto !== 'string' || !nomeProduto.trim()) {
      throw new Error('Informe código e nome do produto no cenário ' + id + '.')
    }
    if (ensacados && (!Number.isSafeInteger(quantidade) || quantidade <= 0 || !Number.isFinite(pesoUnitarioKg) || pesoUnitarioKg <= 0)) {
      throw new Error('Informe quantidade inteira e peso unitário positivos no cenário ' + id + '.')
    }
    if (ensacados && (typeof fornecedor !== 'string' || !fornecedor.trim() || !Number.isSafeInteger(validadeDias) || validadeDias <= 0)) {
      throw new Error('Informe fornecedor e dias de validade positivos no cenário ' + id + '.')
    }
    if (!ensacados && (!Number.isFinite(pesoTotalNfKg) || pesoTotalNfKg <= 0)) throw new Error('Peso total inválido no cenário ' + id + '.')
    ids.add(id)
    return { id, codigoProduto: codigoProduto.trim(), nomeProduto: nomeProduto.trim(),
      ...(ensacados ? { quantidade, pesoUnitarioKg, fornecedor: fornecedor.trim(), validadeDias, pesoTotalNfKg: quantidade * pesoUnitarioKg } : { pesoTotalNfKg }) }
  })
}

module.exports = { carregarCenarios }
