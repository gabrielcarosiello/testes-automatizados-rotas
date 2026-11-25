const texto = el => el.textContent.replace(/\s+/g, ' ').trim()

function lerTesteProducao(grade) {
  const linhas = [...grade.querySelectorAll('tr, [role="row"], .dxbl-grid-data-row')]
  const insumos = linhas.map(linha => {
    const celulas = [...linha.children].filter(el => el.matches('td, [role="cell"], [role="gridcell"]')).map(texto)
    const inicio = celulas.findIndex((valor, indice) => /^\d+$/.test(valor) && celulas[indice + 1] && celulas.length >= indice + 6)
    return inicio < 0 ? null : celulas.slice(inicio, inicio + 6)
  }).filter(Boolean).map(([ordem, produto, balanca, silo, peso, situacao]) =>
    ({ ordem, produto, balanca, silo, peso, situacao }))
  const mensagemDeImpedimento = /^\d+\s*-\s*\S/
  const impedimentos = [...new Set([...grade.querySelectorAll('div, span, li, p, td')]
    .filter(el => mensagemDeImpedimento.test(texto(el)) &&
      ![...el.children].some(filho => mensagemDeImpedimento.test(texto(filho))))
    .map(texto))]
  const aprovado = insumos.length > 0 && insumos.every(insumo => /^ok$/i.test(insumo.situacao)) && impedimentos.length === 0
  return { insumos, impedimentos, aprovado }
}

module.exports = { lerTesteProducao }
