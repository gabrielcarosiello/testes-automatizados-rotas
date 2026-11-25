const seletorModal = '[role="dialog"], [aria-modal="true"], .dxbl-modal'
const seletorBloqueado = ':disabled, [aria-disabled="true"], .disabled, .container-button-disabled'

function localizarConfirmarProducao(documento, visivel) {
  const botoes = [...documento.querySelectorAll('button.botao-confirmar')].filter(botao =>
    visivel(botao) && /^Confirmar$/i.test(botao.textContent.trim()))
  const modais = [...documento.querySelectorAll(seletorModal)].filter(visivel)
  return modais.length ? botoes.filter(botao => modais.some(modal => modal.contains(botao))) : botoes
}

function confirmarProducaoHabilitado(botao) {
  return botao && !botao.closest(seletorBloqueado)
}

module.exports = { localizarConfirmarProducao, confirmarProducaoHabilitado }
