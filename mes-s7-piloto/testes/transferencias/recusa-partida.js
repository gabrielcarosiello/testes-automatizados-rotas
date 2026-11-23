const { confirmarVazio } = require('../../comum/cartoes-mes')
'use strict'
const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

// O MES pode separar as frases com <br>, que textContent extrai sem espaço.
const textoAviso = el => el.textContent.replace(/\.(?=O destino\b)/i, '. ').replace(/\s+/g, ' ').trim()

// Não confundir uma recusa de partida com o nível alto provocado pelo ensaio.
function detectarRecusaNivelAlto(documento, destino, visivel) {
  const esperado = normalizar(`Não foi possível iniciar a transferência. O destino ${destino} está em nível alto.`)
  const encontrados = [...documento.body.querySelectorAll('*')].filter(el =>
    !el.closest('#integracao-visualizacao-s7') && visivel(el) && normalizar(textoAviso(el)) === esperado)
  const folhas = encontrados.filter(el => !encontrados.some(outro => outro !== el && el.contains(outro)))
  if (!folhas.length) return null
  if (folhas.length !== 1) throw new Error('Mais de um aviso de recusa por nível alto; intervenção necessária.')
  let painel = folhas[0]
  while (painel && painel !== documento.body) {
    const botoes = [...painel.querySelectorAll('button, input[type="button"]')].filter(el => visivel(el) && normalizar(el.textContent || el.value) === 'ok')
    if (botoes.length > 1) throw new Error('Aviso de nível alto com botão OK ambíguo.')
    if (botoes.length === 1) return { mensagem: textoAviso(folhas[0]), botao: botoes[0] }
    painel = painel.parentElement
  }
  throw new Error('Recusa por nível alto identificada, mas o botão OK não foi localizado no aviso.')
}
function confirmarLocalVazio(documento, visivel) {
  if (!confirmarVazio(documento, visivel)) throw new Error('Recusa de partida: ausência de transferência ainda não confirmada; lote permanece bloqueado.')
  return true
}
function tratarRecusaPartida({ cy, execucao, visivel, ocultarMonitor, falharTeste = true }) {
    if (!execucao.atual?.inicioRota || execucao.atual.normalConfirmado || execucao.atual.recusaPartida) return cy.wrap(null, { log: false })
    return cy.document({ log: false }).then(doc => {
      const aviso = detectarRecusaNivelAlto(doc, execucao.atual.rota.destino, visivel)
      if (!aviso) return null
      const atual = execucao.atual
      atual.etapa = 'Partida recusada: destino já em nível alto'
      atual.detalhes = [atual.detalhes, aviso.mensagem].filter(Boolean).join(' | ')
      return ocultarMonitor().then(() => {
        const nome = `${execucao.pasta}/mes-recusa-nivel-alto-rota-${atual.rota.codigo}${atual.rearmeTentado ? '-tentativa-2' : ''}`
        atual.captura = nome
        return cy.screenshot(nome, { capture: 'viewport', overwrite: false })
      }).then(() => cy.document({ log: false })).then(documento => {
        // Consultar novamente após a captura: o MES pode ter renderizado outro botão.
        const presente = detectarRecusaNivelAlto(documento, atual.rota.destino, visivel)
        if (!presente) throw new Error('O aviso de recusa mudou antes de confirmar OK.')
        return cy.wrap(presente.botao).click()
      }).then(() => cy.get('body', { timeout: 15000 }).should($body => {
        const documento = $body[0].ownerDocument
        if (detectarRecusaNivelAlto(documento, atual.rota.destino, visivel)) throw new Error('O aviso de recusa ainda está aberto.')
        confirmarLocalVazio(documento, visivel)
      })).then(() => {
        atual.recusaPartida = true
        atual.detalhes += ' | Aviso fechado e ausência de transferência confirmada; próxima rota liberada.'
        if (!execucao.restauracaoFalhou) execucao.anterior = null
        if (falharTeste) throw new Error(atual.etapa + ': ' + aviso.mensagem)
        return true
      })
    })
  }

module.exports = { detectarRecusaNivelAlto, confirmarLocalVazio, tratarRecusaPartida }
