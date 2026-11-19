'use strict'
function avaliarResultadoBusca({ correspondencias, vazio, agora, prazo }) {
  if (correspondencias > 1) throw new Error('Mais de uma opção exata encontrada na busca.')
  if (correspondencias === 1) return 'encontrada'
  if (agora < prazo) return 'aguardar'
  return vazio ? 'vazia' : 'nao-confirmada'
}
module.exports = { avaliarResultadoBusca }
