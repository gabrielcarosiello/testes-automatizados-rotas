const idObservado = 'id6b149b5d-f68f-4fd4-9c46-8f8891f00f50'
const rotulo = el => el.textContent.replace(/\s+/g, ' ').trim() === 'Adicionar'

function controleAdicionarOrdem(doc, visivel) {
  const observado = doc.getElementById(idObservado)
  const ids = [...doc.querySelectorAll('[id^="id"]')].filter(el =>
    /^id[\da-f-]{36}$/i.test(el.id) && visivel(el) && [...el.querySelectorAll('*')].some(rotulo))
  const exclusivos = ids.filter(el => !ids.some(outro => outro !== el && el.contains(outro)))
  const alvo = observado && visivel(observado) && (rotulo(observado) ||
    [...observado.querySelectorAll('*')].some(rotulo)) ? observado : exclusivos.length === 1 ? exclusivos[0] : null
  if (!alvo) return null
  const internos = [...alvo.querySelectorAll('.container-button, button, [role="button"]')]
    .filter(el => visivel(el) && (rotulo(el) || [...el.querySelectorAll('*')].some(rotulo)))
    .filter((el, _, itens) => !itens.some(outro => outro !== el && el.contains(outro)))
  return internos.length === 1 ? internos[0] : internos.length === 0 ? alvo : null
}

module.exports = { controleAdicionarOrdem }
