'use strict'
function avaliarCartoes({ vazio, cartoes, nomePermitido = null, exigeAtiva = false }) {
  if (cartoes.length > 1) throw new Error('Mais de uma transferência no local; intervenção necessária')
  if (cartoes.length === 0) {
    if (exigeAtiva) throw new Error('A transferência não apareceu para parada; verificação necessária')
    if (!vazio) throw new Error('Estado das transferências não identificado; intervenção necessária')
    return 'vazio'
  }
  const c = cartoes[0]
  if (!c.nome) throw new Error('Cartão sem nome identificado')
  if (nomePermitido !== null && c.nome !== nomePermitido) throw new Error('Transferência diferente da esperada: ' + c.nome)
  if (!exigeAtiva && !c.quantidadeSituacoes && c.quantidadeBotoes === 0 && c.quantidadeLimpar === 1) return 'limpar'
  if (c.quantidadeBotoes !== 1 || c.quantidadeSituacoes !== 1) throw new Error('Cartão ou botão Parar não identificado de forma única')
  return 'parar'
}
module.exports = { avaliarCartoes }
