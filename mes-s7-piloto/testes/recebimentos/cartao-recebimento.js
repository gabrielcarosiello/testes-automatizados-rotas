const { lerSituacoes } = require('../../comum/cartoes-mes')

function normalizarStatus(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function lerCartao(painel, visivel, { ordem, rota }) {
  const contem = (texto, valor) => texto.split(/[^\p{L}\p{N}]+/u).includes(String(valor))
  const estados = [...painel.querySelectorAll('.card-situations')].filter(visivel)
  const cartoes = [...new Set(estados.map(el => el.closest('.row')).filter(cartao => cartao && painel.contains(cartao)))]
    .filter(cartao => contem(cartao.textContent, ordem) && contem(cartao.textContent, rota.destino))
  if (cartoes.length !== 1) return { cartoes, status: [], expandir: null }
  const [cartao] = cartoes
  const icones = [...cartao.querySelectorAll('span > .svgbtn-base > div')]
    .filter(el => visivel(el) && el.closest('.row') === cartao)
  if (icones.length === 1) return { cartoes, status: lerSituacoes(cartao, visivel), expandir: icones[0] }
  const ehMais = el => /^[+＋]$/.test(el.textContent.trim())
  const controles = [...cartao.querySelectorAll('*')]
    .filter(el => ehMais(el) && visivel(el) && ![...el.children].some(filho => ehMais(filho) && visivel(filho)))
    .map(el => {
      const controle = el.closest('button, [role="button"]')
      return controle && cartao.contains(controle) ? controle : el
    })
  const unicos = [...new Set(controles)]
  return { cartoes, status: lerSituacoes(cartao, visivel), expandir: unicos.length === 1 ? unicos[0] : null }
}

function botoesComTexto(raiz, texto, visivel) {
  return [...raiz.querySelectorAll('button, [role="button"], .container-button')].filter(el =>
    visivel(el) && normalizarStatus(el.textContent) === normalizarStatus(texto) &&
    !el.closest(':disabled, [aria-disabled="true"], [disabled], .disabled'))
    .filter((el, _, candidatos) => !candidatos.some(outro => outro !== el && el.contains(outro)))
}

function botoesConfirmacao(documento, mensagem, visivel) {
  const dialogos = [...documento.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"], .modal.show, .modal-content')]
    .filter(dialogo => visivel(dialogo) && [...dialogo.querySelectorAll('*')].some(el =>
      visivel(el) && normalizarStatus(el.textContent) === normalizarStatus(mensagem)))
  return [...new Set(dialogos.flatMap(dialogo => botoesComTexto(dialogo, 'Sim', visivel)))]
}

function painelRecebimentoLivre(painel, visivel) {
  const ativos = [...painel.querySelectorAll('.card-situations')].some(visivel)
  const mensagem = [...painel.querySelectorAll('*')].some(el =>
    visivel(el) && normalizarStatus(el.textContent) === 'nao ha nenhum recebimento em uso')
  return mensagem && !ativos
}

function estadoDeEncerramento(painel, visivel, recebimento) {
  if (painelRecebimentoLivre(painel, visivel)) return 'livre'
  const { status } = lerCartao(painel, visivel, recebimento)
  return status.some(texto => normalizarStatus(texto) === 'parando') ? 'parando' : null
}

module.exports = { painelRecebimentoLivre, estadoDeEncerramento, lerCartao, normalizarStatus, botoesComTexto, botoesConfirmacao }
