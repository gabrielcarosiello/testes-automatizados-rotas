'use strict'
const { diagnosticarLocal } = require('./cartoes-mes')
const { limparTransferencia } = require('./limpar-transferencia')

const habilitado = botao => !botao.matches(':disabled, [aria-disabled="true"]')
const normalizar = texto => texto.replace(/\s+/g, ' ').trim()
const texto = el => el.innerText ?? el.textContent
const seletorDialogo = 'dialog[open], [role=dialog], [aria-modal=true], .modal.show'

function identificarTransferenciaInterrompida(estado, rota) {
  const [cartao] = estado.cartoes
  if (estado.dialogos || estado.confirmacao || estado.cartoes.length !== 1 || cartao.ambiguo ||
      cartao.nome !== rota.nome || !cartao.textosSituacoes.some(s => /^interrompid[oa]$/i.test(s)) ||
      cartao.botoes.some(habilitado) || cartao.limpar.length !== 1 || !habilitado(cartao.limpar[0])) return null
  const corpo = texto(cartao.linha)
  const id = corpo.match(/(?:^|\n)\s*Transferência[ \t]*\n\s*(\d+)\b/i)?.[1]
  const trajeto = corpo.match(/Origem\s*\/\s*Destino Atual\s+([^\s]+)\s*(?:->|→)\s*([^\s]+)/i)
  if (!id || trajeto?.[1] !== rota.origem || trajeto[2] !== rota.destino) return null
  return { id, cartao }
}

function lerSituacoesEquipamentos(dialogo, visivel) {
  return [...new Set([...dialogo.querySelectorAll('tr, [role=row], li')].filter(visivel)
    .map(el => {
      const celulas = [...el.querySelectorAll('td, [role=cell], [role=gridcell]')].filter(visivel)
      return normalizar(celulas.length ? celulas.map(texto).join(' · ') : texto(el))
    })
    .filter(linha => /\b[A-Z]{1,8}\d{1,8}\b/.test(linha) &&
      /\b(?:emerg[eê]ncia|falha|bloquead[oa]|bloqueio|intertravad[oa]|intertravamento|inoperante|indispon[ií]vel)\b/i.test(
        linha.replace(/\bsem\s+(?:emerg[eê]ncia|falha|bloqueio|intertravamento)\b/gi, '')
      )))].slice(0, 30)
}

function diagnosticarELimparInterrompida({ cy, execucao, atual, identificada, visivel }) {
  const { rota } = atual
  const { cartao, id } = identificada
  const registrar = etapa => cy.task('registrarEtapa', { pasta: execucao.pasta, codigo: rota.codigo, etapa }, { log: false })
  const pendentes = (atual.s7?.tags || []).filter(tag => tag.good !== true || tag.value !== true)
    .map(tag => `${tag.label} (${tag.good === true ? 'retorno não confirmado' : 'leitura indisponível'})`)

  function detalhes() {
    const botoes = [...cartao.linha.querySelectorAll('button')].filter(botao =>
      visivel(botao) && habilitado(botao) && normalizar(texto(botao)) === 'Mais Informações')
    if (botoes.length !== 1) return cy.wrap([], { log: false })
    return cy.wrap(botoes[0], { log: false }).click().then(() => {
      let dialogo
      return cy.get('body', { timeout: 8000 }).should($body => {
        const visiveis = [...$body[0].querySelectorAll(seletorDialogo)].filter(visivel)
        if (visiveis.length !== 1) throw new Error('Detalhes da transferência não identificados em diálogo único.')
        dialogo = visiveis[0]
      }).then(() => {
        const situacoes = lerSituacoesEquipamentos(dialogo, visivel)
        const fechar = [...dialogo.querySelectorAll('button')].filter(botao =>
          visivel(botao) && habilitado(botao) &&
          /^(Fechar|Voltar|OK)$/i.test(normalizar(botao.getAttribute('aria-label') || botao.title || texto(botao))))
        if (fechar.length !== 1) throw new Error('Comando para fechar os detalhes da transferência não identificado.')
        return cy.wrap(fechar[0], { log: false }).click().then(() => situacoes)
      })
    })
  }

  const resumo = `Transferência ${id}: ${rota.origem} → ${rota.destino}, ${cartao.textosSituacoes.join(', ')}.`
  const sinaisS7 = pendentes.length ? 'S7: ' + pendentes.join(', ') : ''
  atual.tentouLimparInterrompida = true
  execucao.anterior ||= { local: rota.local, nome: rota.nome }
  atual.etapa = 'Diagnosticar transferência interrompida'
  atual.detalhes = [atual.detalhes, resumo, sinaisS7].filter(Boolean).join(' | ')
  if (execucao.restauracaoFalhou) throw new Error('Limpeza bloqueada por restauração pendente.')

  return detalhes().then(situacoes => {
    const complemento = situacoes.length ? 'Equipamentos no MES: ' + situacoes.join(' | ') :
      'Sem situação de equipamento identificada nos detalhes do MES.'
    atual.detalhes += ' | ' + complemento
    return registrar((resumo + ' ' + complemento).slice(0, 300))
  }).then(() => cy.document({ log: false })).then(documento => {
    const atualizada = identificarTransferenciaInterrompida(diagnosticarLocal(documento, visivel), rota)
    if (atualizada?.id !== id) throw new Error('Cartão interrompido mudou antes de Limpar.')
    return limparTransferencia({ cy, nome: rota.nome, botao: atualizada.cartao.limpar[0], visivel })
  }).then(() => {
    atual.detalhes += ' | Limpeza confirmada no MES.'
    execucao.anterior = null
    throw new Error('Transferência interrompida por impedimento. Local liberado para a próxima rota.')
  })
}

module.exports = { identificarTransferenciaInterrompida, lerSituacoesEquipamentos, diagnosticarELimparInterrompida }
