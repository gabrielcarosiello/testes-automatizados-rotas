// Preparação: npm install em mes-s7-piloto e monitor-s7 (incluindo dependências de teste).
const { spawnSync } = require('node:child_process'), path = require('node:path'), fs = require('node:fs')
const raiz = __dirname
const grupos = [
  { nome: 'Piloto', cwd: path.join(raiz, 'mes-s7-piloto'), arquivos: ['comum', 'comum/s7', 'testes/transferencias'].flatMap(p => fs.readdirSync(path.join(raiz, 'mes-s7-piloto', p)).filter(n => n.endsWith('.test.js')).map(n => path.join(p, n))) },
  { nome: 'Monitor', cwd: path.join(raiz, 'monitor-s7'), arquivos: fs.readdirSync(path.join(raiz, 'monitor-s7/test')).filter(n => n.endsWith('.test.mjs')).map(n => 'test/' + n) },
  { nome: 'Integração simulada', cwd: raiz, arquivos: ['verificar-integracao.test.cjs'] },
]
let falhou = false
for (const grupo of grupos) {
  console.log('\n' + grupo.nome)
  const resultado = spawnSync(process.execPath, ['--test', ...grupo.arquivos], { cwd: grupo.cwd, stdio: 'inherit' })
  if (resultado.error || resultado.status !== 0) { falhou = true; console.error(resultado.error?.message || `${grupo.nome}: há testes com falha.`) }
}
process.exitCode = falhou ? 1 : 0
