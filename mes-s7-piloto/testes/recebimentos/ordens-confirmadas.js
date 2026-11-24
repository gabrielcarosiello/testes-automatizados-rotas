const fs = require('node:fs')
const path = require('node:path')

function lerOrdensConfirmadas(pastaResultados) {
  const ordens = []
  if (!fs.existsSync(pastaResultados)) return ordens
  for (const pasta of fs.readdirSync(pastaResultados, { withFileTypes: true })) {
    if (!pasta.isDirectory() || !pasta.name.startsWith('Ordem_Recebimento_')) continue
    const arquivo = path.join(pastaResultados, pasta.name, 'eventos.jsonl')
    if (!fs.existsSync(arquivo)) continue
    const linhas = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/).filter(Boolean)
    let evento
    try { evento = JSON.parse(linhas.at(-1) || 'null') } catch { continue }
    const dados = evento?.dados
    if (evento?.tipo === 'resultado' && dados?.resultado === 'Concluída' &&
        dados.confirmadaNaLista === true && /^\d+$/.test(dados.numero) && dados.item?.id && dados.item?.codigoProduto) {
      ordens.push({ numero: dados.numero, item: dados.item, data: evento.data })
    }
  }
  return ordens.sort((a, b) => String(b.data).localeCompare(String(a.data)))
}

module.exports = { lerOrdensConfirmadas }
