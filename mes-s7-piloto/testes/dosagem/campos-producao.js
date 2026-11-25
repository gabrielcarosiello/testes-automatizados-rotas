const texto = el => el.textContent.replace(/\s+/g, ' ').trim()
const entradas = 'input:not([type="hidden"])'

function localizarCamposProducao(doc, visivel, rotulo, seletor, quantidade = 1, indice = 0) {
  const textos = 'label, span, div, td, h1, h2, h3, h4, h5, h6, b, strong'
  const rotulos = [...doc.querySelectorAll(textos)].filter(el =>
    visivel(el) && rotulo.test(texto(el)) && ![...el.children].some(filho => rotulo.test(texto(filho))))
  const modais = rotulos.filter(el => el.closest('[role="dialog"], [aria-modal="true"], .dxbl-modal'))
  const candidatos = modais.length ? modais : rotulos
  const campos = new Set()
  for (const label of candidatos) {
    if (quantidade === 1 && label.control?.matches(seletor) && visivel(label.control)) {
      campos.add(label.control)
      continue
    }
    const limite = label.closest('[role="dialog"], [aria-modal="true"], .dxbl-modal') || doc.body
    for (let grupo = label; grupo && grupo !== limite; grupo = grupo.parentElement) {
      const elementos = [...grupo.querySelectorAll(seletor)].filter(visivel)
      const externos = elementos.filter(el => !elementos.some(outro => outro !== el && outro.contains(el)))
      if (externos.length > quantidade) break
      if (externos.length === quantidade) {
        campos.add(externos[indice])
        break
      }
    }
  }
  return [...campos]
}

function opErpSemPreenchimento(doc, visivel) {
  const campos = localizarCamposProducao(doc, visivel, /^OP ERP:?$/i, entradas)
  return campos.length === 0 || (campos.length === 1 && campos[0].value === '')
}

function producaoLiberada(linha, visivel) {
  const selos = [...linha.querySelectorAll('.container-status > .color')].filter(visivel)
  return selos.length === 1 && /^Liberado$/i.test(texto(selos[0]))
}

function localizarRotuloLiberacao(painel, visivel) {
  return [...painel.querySelectorAll('dxbl-check label')].filter(label =>
    visivel(label) && /^Liberada para Produção$/i.test(texto(label)) && label.control?.type === 'checkbox')
}

function lerPassosDaProducao(painel, { producao, lote, destino }, visivel) {
  return [...painel.querySelectorAll('tr, [role="row"]')].filter(visivel).flatMap(linha => {
    const celulas = [...linha.children].filter(el => el.matches('td, [role="gridcell"]'))
    const inicio = celulas.findIndex((el, i) => /^\d+\s*[-–]/.test(texto(el)) && texto(celulas[i + 1] || el) === lote)
    if (inicio < 0 || celulas.length < inicio + 7) return []
    const [passo, , numero, batelada, , silo] = celulas.slice(inicio, inicio + 6).map(texto)
    if (numero !== producao || !/^[1-9]\d*$/.test(batelada) || silo !== destino) return []
    const situacao = celulas[inicio + 6]
    const selos = [situacao, ...situacao.querySelectorAll('*')]
      .filter(el => visivel(el) && texto(el) && ![...el.children].some(filho => visivel(filho) && texto(filho)))
      .map(texto).filter(valor => !/^[+×–-]$/.test(valor))
    return [{ passo, batelada, destino: silo, situacoes: [...new Set(selos)] }]
  })
}

function passosAtivosDaProducao(painel, identidade, visivel) {
  return lerPassosDaProducao(painel, identidade, visivel).flatMap(({ situacoes, ...passo }) => {
    const situacao = situacoes.find(valor => /^(Rodando|Ocupado)$/i.test(valor))
    return situacao ? [{ ...passo, situacao }] : []
  })
}

function lerContagemBateladas(valor) {
  const contagem = String(valor).trim()
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(contagem)) return NaN
  return Number(contagem.replaceAll('.', ''))
}

module.exports = { lerContagemBateladas, lerPassosDaProducao, passosAtivosDaProducao, localizarCamposProducao, opErpSemPreenchimento, producaoLiberada, localizarRotuloLiberacao }
