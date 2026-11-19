const fs = require('node:fs'), path = require('node:path')
const { resumirEventos } = require('../comum/resumo-execucao')
const pasta = process.argv[2]
if (!pasta || !/^[a-zA-Z0-9_-]+$/.test(pasta)) { console.error('Uso: npm run resumo -- Teste_rotas_Rev00_...'); process.exitCode = 1 } else {
  const destino = path.resolve(__dirname, '../resultados', pasta)
  try {
    const resumo = resumirEventos(path.join(destino, 'eventos.jsonl'))
    fs.writeFileSync(path.join(destino, 'resumo.json'), JSON.stringify(resumo, null, 2))
    console.log(JSON.stringify({ ...resumo, rotas: resumo.rotas.filter(r => r.resultado !== 'Concluída').map(r => ({ codigo: r.codigo, categoria: r.categoria, etapa: r.etapa, detalhes: r.detalhes, persistido: r.persistido })) }, null, 2))
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}
