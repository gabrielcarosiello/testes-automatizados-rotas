const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto')
const { recuperarCopia } = require('../comum/gravar-lir'), { lerExecucao } = require('../comum/execucao')
const { ler } = require('../testes/transferencias/lir-rotas')
const raiz = path.resolve(__dirname, '..')
try {
  const argumento = process.argv[2]
  const arquivo = argumento ? path.resolve(argumento) : (() => { const cfg = lerExecucao(raiz); return cfg.planilha ? path.resolve(raiz, cfg.planilha) : ler(raiz).arquivo })()
  if (!/\.xlsx$/i.test(arquivo)) throw new Error('Informe o arquivo .xlsx original que apresenta o aviso do Excel.')
  const nome = path.basename(arquivo, path.extname(arquivo)), carimbo = new Date().toISOString().replace(/[:.]/g, '-')
  const destino = path.join(raiz, 'resultados', 'recuperacao', `${nome}.recuperada-${carimbo}-${randomUUID().slice(0, 6)}.xlsx`)
  const resultado = recuperarCopia(arquivo, destino)
  fs.writeFileSync(destino + '.json', JSON.stringify(resultado, null, 2))
  console.log('Cópia recuperada: ' + resultado.copia)
  console.log('Original preservado: ' + resultado.originalPreservado)
  console.log('Declarações de namespace corrigidas: ' + resultado.reparos.reduce((n, r) => n + r.declaracoes, 0))
  console.log('Abra a cópia no Excel e confira os resultados antes de substituir sua planilha ativa.')
  console.log('Se o Excel já removeu conteúdo e você salvou por cima, esta ferramenta não reconstrói os dados apagados; utilize o original/backup.')
} catch (e) { console.error(e.message); process.exitCode = 1 }
