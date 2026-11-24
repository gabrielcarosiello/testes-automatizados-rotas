// Regressão de leitura da LIR preparada com Cypress Author em 24/11/2026.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const XLSX = require('xlsx')
const { lerRotaRecebimento } = require('./lir-recebimento')

test('lê a rota 14 e a ordem 9390 somente da aba de Recebimento', t => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'lir-recebimento-'))
  t.after(() => fs.rmSync(raiz, { recursive: true }))
  fs.mkdirSync(path.join(raiz, 'planilhas'))
  const arquivo = path.join(raiz, 'planilhas', 'LIR.xlsx')
  const cabecalhos = ['ID Rota', 'Origem', 'Destino', 'Rota', 'IO Nível Alto', 'ID Digital LSH', 'Ordem de Recebimento']
  const caminho = 'RG01->RG03->RG04->RG22->MG01'
  const linha = [14, 'RG01', 'MG01', caminho, 'LSH_MG01', 26, 9390]
  const aba = (...linhas) => XLSX.utils.aoa_to_sheet([...Array.from({ length: 7 }, () => []), cabecalhos, ...linhas])
  function salvar(...linhas) {
    const livro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(livro, aba([99, ...linha.slice(1)]), 'Lista de Rotas - Transferências')
    XLSX.utils.book_append_sheet(livro, aba(...linhas), 'Lista de Rotas - Recebimento')
    XLSX.writeFile(livro, arquivo)
  }
  salvar(linha)
  assert.deepEqual(lerRotaRecebimento(raiz), {
    codigo: '14', ordem: '9390', origem: 'RG01', destino: 'MG01', rota: caminho,
    nivelAlto: { io: 'LSH_MG01', idDigital: 26, aplicavel: true },
  })
  salvar([14, 'RG01', 'MG01', 'outra rota', 'LSH_MG01', 26, 9390])
  assert.throws(() => lerRotaRecebimento(raiz, arquivo), /cadastro único/)
  salvar(linha, linha)
  assert.throws(() => lerRotaRecebimento(raiz, arquivo), /cadastro único/)
})
