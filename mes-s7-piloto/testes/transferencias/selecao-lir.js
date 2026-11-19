'use strict'
const identidade = ['codigo', 'local', 'nome', 'origem', 'destino', 'rota']

function resumirLir(rotas) {
  const resumo = { total: rotas.length, teste: { OK: 0, NOK: 0, NT: 0, '---': 0 }, nivelAlto: { pendentesComSinal: 0, semSinal: [] } }
  for (const rota of rotas) {
    resumo.teste[rota.status]++
    if (rota.nivelAlto?.aplicavel && ['NT', 'NOK'].includes(rota.nivelAlto.status)) resumo.nivelAlto.pendentesComSinal++
    if (!rota.nivelAlto?.aplicavel) resumo.nivelAlto.semSinal.push(rota.codigo)
  }
  return resumo
}
function selecionarRotas(rotas, { codigoRota, testarNivelAlto = false, modoSelecao = 'pendentes' } = {}) {
  if (!['pendentes', 'todas', 'falhas', 'nao-testadas'].includes(modoSelecao)) throw new Error('modoSelecao inválido: use pendentes, todas, falhas ou nao-testadas.')
  if (codigoRota !== null && codigoRota !== undefined) {
    if (!Number.isInteger(codigoRota) || codigoRota < 1 || codigoRota > 32767) throw new Error('codigoRota deve ser inteiro entre 1 e 32767, ou null para todas as pendentes.')
    const encontradas = rotas.filter(rota => Number(rota.codigo) === codigoRota)
    if (encontradas.length !== 1) throw new Error(`A rota ${codigoRota} não foi encontrada uma única vez na aba de transferências da LIR.`)
    const rota = encontradas[0]
    if (rota.status === '---') throw new Error(`Rota ${codigoRota}: Teste está em --- (não aplicável). Revise a LIR antes de executar.`)
    if (!['OK', 'NT', 'NOK'].includes(rota.status)) throw new Error(`Rota ${codigoRota}: status Teste inválido.`)
    return [{ ...rota, statusInicial: rota.status, tipoExecucao: rota.status === 'OK' ? 'reteste' : 'pendente' }]
  }
  return rotas.filter(rota => {
    if (rota.status === '---') return false
    if (modoSelecao === 'todas') return true
    if (modoSelecao === 'falhas') return rota.status === 'NOK' || (testarNivelAlto && rota.nivelAlto?.aplicavel && rota.nivelAlto.status === 'NOK')
    if (modoSelecao === 'nao-testadas') return rota.status === 'NT'
    return ['NT', 'NOK'].includes(rota.status) || (testarNivelAlto && rota.nivelAlto?.aplicavel && ['NT', 'NOK'].includes(rota.nivelAlto.status))
  }).map(rota => ({ ...rota, statusInicial: rota.status, tipoExecucao: rota.status === 'OK' ? 'reteste' : 'pendente' }))
}
function conferirRotaAtual(rotas, inicial) {
  if (!inicial) throw new Error('Rota não autorizada para esta execução.')
  const atual = rotas.find(rota => String(rota.codigo) === String(inicial.codigo))
  if (!atual || identidade.some(campo => String(atual[campo]) !== String(inicial[campo])) || atual.status !== inicial.status ||
      JSON.stringify(atual.nivelAlto) !== JSON.stringify(inicial.nivelAlto)) {
    throw new Error(`Rota ${inicial.codigo}: dados ou status da LIR mudaram desde a seleção. Recarregue a suíte antes de executar/gravar.`)
  }
  return atual
}
module.exports = { selecionarRotas, resumirLir, conferirRotaAtual }
