'use strict'

// Preparação Piloto 09.1: código de configuração, não valor da entrada.
// 0 = contato NA; 1 = contato NF. Não inferir a polaridade pelo ID da digital.
function configurarContatoLSH(tipoContatoLSH) {
  // Configurações anteriores continuam executando apenas o ensaio normal.
  // Ausência não escolhe uma polaridade para o futuro ensaio de nível alto.
  if (tipoContatoLSH === undefined) return null
  if (tipoContatoLSH !== 0 && tipoContatoLSH !== 1) {
    throw new Error('tipoContatoLSH em s7.local.json deve ser o número 0 (NA) ou 1 (NF).')
  }
  return {
    tipoContatoLSH,
    contato: tipoContatoLSH === 0 ? 'NA' : 'NF',
    valorNivelAlto: tipoContatoLSH === 0,
    valorSemNivelAlto: tipoContatoLSH === 1,
  }
}

module.exports = { configurarContatoLSH }
