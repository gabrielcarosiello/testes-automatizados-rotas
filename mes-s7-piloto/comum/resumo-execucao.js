'use strict'
const fs = require('node:fs')
function resumirEventos(arquivo) {
  const linhas = fs.readFileSync(arquivo, 'utf8').split('\n'), avisos = [], resultados = new Map(), persistidos = new Set()
  for (let i = 0; i < linhas.length; i++) {
    if (!linhas[i].trim()) continue
    let evento
    try { evento = JSON.parse(linhas[i]) } catch { avisos.push(`Linha ${i + 1} incompleta/inválida; consultar eventos.jsonl.`); continue }
    if (evento.tipo === 'resultado-recebido') resultados.set(String(evento.dados.codigo), { ...evento.dados, idResultado: evento.id })
    if (evento.tipo === 'resultado-persistido') persistidos.add(evento.dados.idResultado)
  }
  const rotas = [...resultados.values()].map(r => ({ ...r, persistido: persistidos.has(r.idResultado) }))
  return { rotas, totalRegistrado: rotas.length, corretas: rotas.filter(r => r.resultado === 'Concluída').length, falhas: rotas.filter(r => r.resultado === 'Falhou').length, persistenciasPendentes: rotas.filter(r => !r.persistido).map(r => r.codigo), avisos }
}
module.exports = { resumirEventos }
