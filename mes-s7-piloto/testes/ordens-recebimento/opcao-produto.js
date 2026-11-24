const normalizar = texto => String(texto ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()

function localizarOpcaoProduto(doc, codigo, nome, visivel) {
  const buscas = [...doc.querySelectorAll('input[placeholder^="Buscar"]')].filter(visivel)
  if (buscas.length !== 1) return null
  const [busca] = buscas
  const codigoExato = el => normalizar(el.textContent) === codigo
  for (let grupo = busca.parentElement; grupo && grupo !== doc.body; grupo = grupo.parentElement) {
    const rotulos = [...grupo.querySelectorAll('th, [role="columnheader"], span, div')].filter(visivel)
      .map(el => normalizar(el.textContent).toLowerCase())
    const lista = grupo.querySelector('[role="listbox"]')
    if (!(lista && visivel(lista)) && !(rotulos.includes('nome') && rotulos.includes('código'))) continue
    const codigos = [...grupo.querySelectorAll('td, [role="gridcell"], span, div, a')].filter(el =>
      visivel(el) && codigoExato(el) && ![...el.children].some(filho => visivel(filho) && codigoExato(filho)))
    if (!codigos.length) return null
    const opcoes = codigos.filter(el => {
      for (let linha = el.parentElement; linha && linha !== grupo && !linha.contains(busca); linha = linha.parentElement) {
        if (normalizar(linha.textContent).includes(nome)) return true
      }
      return false
    })
    return opcoes.length === 1 ? opcoes[0] : null
  }
  return null
}

module.exports = { localizarOpcaoProduto }
