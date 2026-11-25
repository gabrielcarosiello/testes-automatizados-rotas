const fs = require('node:fs')
const path = require('node:path')
const { gravarEvento } = require('../../comum/registro-execucao')

function tarefasEvidenciasDosagem(raiz) {
  return {
    registrarEvidenciaDosagem({ lote, tipo, etapa, resultado, erro }) {
      if (typeof lote !== 'string' || !/^\d{13}$/.test(lote)) throw new Error('Lote inválido para evidência de Dosagem.')
      if (!['inicio', 'etapa', 'resultado'].includes(tipo)) throw new Error('Tipo de evidência de Dosagem inválido.')
      const pasta = 'Dosagem_' + lote
      if (tipo === 'inicio') fs.mkdirSync(path.join(raiz, 'resultados', pasta), { recursive: true })
      gravarEvento(raiz, pasta, tipo, { lote, etapa, resultado, erro })
      return 'resultados/' + pasta + '/eventos.jsonl'
    },
  }
}

module.exports = { tarefasEvidenciasDosagem }
