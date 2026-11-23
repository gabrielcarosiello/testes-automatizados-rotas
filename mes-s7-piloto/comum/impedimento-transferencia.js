'use strict'
const { diagnosticarLocal } = require('./cartoes-mes')
const { limparTransferencia } = require('./limpar-transferencia')

const habilitado = botao => !botao.matches(':disabled, [aria-disabled="true"]')
const texto = el => el.innerText ?? el.textContent

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

function registrarDiagnosticoS7(cy, atual) {
  return cy.task('diagnosticarEquipamentosS7', atual.rota.codigo, { timeout: 100000 }).then(diagnostico => {
    const complemento = 'DBs dos equipamentos no Monitor S7: ' + diagnostico.detalhes
    atual.detalhes = [atual.detalhes, complemento].filter(Boolean).join(' | ')
    return { completo: diagnostico.completo, complemento }
  })
}

function diagnosticarInicioDesabilitado({ cy, atual, pilotoS7, condicoes, capturar }) {
  const { origem, destino } = atual.rota
  atual.detalhes = [atual.detalhes, `Iniciar desabilitado para ${origem} → ${destino}.`,
    condicoes || 'O formulário não exibiu condição de bloqueio identificável.'].filter(Boolean).join(' | ')
  return capturar('iniciar-desabilitado').then(() => {
    if (pilotoS7) return registrarDiagnosticoS7(cy, atual)
  }).then(() => { throw new Error('Botão Iniciar desabilitado no MES.') })
}

function diagnosticarELimparInterrompida({ cy, execucao, atual, identificada, visivel }) {
  const { rota } = atual
  const { cartao, id } = identificada
  const registrar = etapa => cy.task('registrarEtapa', { pasta: execucao.pasta, codigo: rota.codigo, etapa }, { log: false })
  const pendentes = (atual.s7?.tags || []).filter(tag => tag.good !== true || tag.value !== true)
    .map(tag => `${tag.label} (${tag.good === true ? 'retorno não confirmado' : 'leitura indisponível'})`)

  const resumo = `Transferência ${id}: ${rota.origem} → ${rota.destino}, ${cartao.textosSituacoes.join(', ')}.`
  const sinaisS7 = pendentes.length ? 'S7: ' + pendentes.join(', ') : ''
  atual.tentouLimparInterrompida = true
  execucao.anterior ||= { local: rota.local, nome: rota.nome }
  atual.etapa = 'Diagnosticar transferência interrompida'
  atual.detalhes = [atual.detalhes, resumo, sinaisS7].filter(Boolean).join(' | ')
  if (execucao.restauracaoFalhou) throw new Error('Limpeza bloqueada por restauração pendente.')

  return registrarDiagnosticoS7(cy, atual).then(({ completo, complemento }) => {
    return registrar((resumo + ' ' + complemento).slice(0, 300)).then(() => {
      if (!completo) throw new Error('Diagnóstico dos DBs incompleto. Transferência mantida para conferência.')
    })
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

module.exports = { identificarTransferenciaInterrompida, diagnosticarELimparInterrompida, diagnosticarInicioDesabilitado }
