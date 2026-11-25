// Instale as dependências de teste nos subprojetos antes de executar.
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function descobrirTestes(diretorio) {
  return fs.readdirSync(diretorio, { recursive: true, withFileTypes: true })
    .filter(entrada => entrada.isFile() && /\.test\.(?:js|cjs|mjs)$/.test(entrada.name))
    .map(entrada => path.join(entrada.parentPath, entrada.name))
    .sort()
}

const raiz = __dirname
const grupos = [
  { nome: 'Piloto', cwd: path.join(raiz, 'mes-s7-piloto'), pastas: ['regressao'] },
  { nome: 'Monitor', cwd: path.join(raiz, 'monitor-s7'), pastas: ['test'] },
  { nome: 'Integração simulada', cwd: raiz, arquivos: ['verificar-integracao.test.cjs'] },
]

let falhou = false
const selecionados = process.argv[2] === '--piloto' ? grupos.slice(0, 1) : grupos
for (const grupo of selecionados) {
  console.log('\n' + grupo.nome)
  try {
    const arquivos = grupo.arquivos ?? grupo.pastas.flatMap(pasta => descobrirTestes(path.join(grupo.cwd, pasta)))
    if (!arquivos.length) throw new Error('Nenhum arquivo de teste encontrado.')
    console.log(arquivos.length + ' arquivo(s) de teste')
    const resultado = spawnSync(process.execPath, ['--test', ...arquivos], { cwd: grupo.cwd, stdio: 'inherit' })
    if (resultado.error) throw resultado.error
    if (resultado.status !== 0) throw new Error('A execução dos testes não terminou com sucesso.')
  } catch (erro) {
    falhou = true
    console.error(grupo.nome + ': ' + erro.message)
  }
}
process.exitCode = falhou ? 1 : 0
