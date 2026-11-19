const padrao = require('../../perfis-s7.json')

function selecionarValidacao(equipamento, configuracao = padrao, modoValidacao = 'sql') {
  if (!['sql', 'entradas'].includes(modoValidacao)) {
    throw new Error('modoValidacao deve ser "sql" ou "entradas" no s7.local.json.')
  }
  const { cod_equipamento, tip_equipamento, val_comando, des_tag } = equipamento
  if (!Number.isInteger(cod_equipamento) || cod_equipamento <= 0) {
    throw new Error('Código de equipamento ausente ou inválido no retorno SQL.')
  }
  if (![1, 2].includes(val_comando)) throw new Error('Comando inválido para selecionar o espelho.')
  if (modoValidacao === 'entradas') {
    return {
      modoValidacao, perfil: 'sempreEntradas',
      espelho: `EspelhoEntrada${val_comando}`, exigirDesligadoAntes: false,
    }
  }
  if (!Number.isInteger(tip_equipamento) || tip_equipamento < 0) {
    throw new Error(`Tipo ausente ou inválido no cadastro SQL de ${des_tag || cod_equipamento}.`)
  }
  const perfil = configuracao.porEquipamento?.[String(cod_equipamento)] ??
    configuracao.porTipo?.[String(tip_equipamento)]
  const regra = configuracao.perfis?.[perfil]
  const espelho = regra?.camposPorComando?.[String(val_comando)]
  if (!/^(EspelhoEntrada|EspelhoSaida)[12]$/.test(espelho || '') ||
      typeof regra?.exigirDesligadoAntes !== 'boolean') {
    throw new Error(`Configure o perfil do equipamento ${cod_equipamento}, tipo SQL ${tip_equipamento}, comando ${val_comando}, em perfis-s7.json.`)
  }
  return { modoValidacao, perfil, espelho, exigirDesligadoAntes: regra.exigirDesligadoAntes }
}

module.exports = { selecionarValidacao }
