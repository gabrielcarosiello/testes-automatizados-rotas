const controles = 'select, .custom-dropdown > .form-select, .form-select, [role="combobox"]'
const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

function localizarComboEnsacados(doc, rotulo, visivel) {
  const corresponde = el => rotulo.test(normalizar(el.textContent))
  const rotulos = [...doc.querySelectorAll('label, span, div, p')].filter(el =>
    visivel(el) && corresponde(el) && ![...el.children].some(filho => visivel(filho) && corresponde(filho)))
  const encontrados = new Set()
  for (const el of rotulos) {
    const nativo = el.closest('label')?.control
    if (nativo?.matches(controles) && visivel(nativo)) { encontrados.add(nativo); continue }
    for (let grupo = el.parentElement; grupo && grupo !== doc.body; grupo = grupo.parentElement) {
      const candidatos = [...grupo.querySelectorAll(controles)].filter(visivel)
        .filter((controle, _, lista) => !lista.some(outro => outro !== controle && outro.contains(controle)))
      if (candidatos.length === 1) encontrados.add(candidatos[0])
      if (candidatos.length) break
    }
  }
  return [...encontrados]
}

module.exports = { localizarComboEnsacados }
