const XLSX = require('xlsx')
const { abrirLir } = require('../transferencias/lir-rotas')

const abaRecebimento = 'Lista de Rotas - Recebimento'

function mapearCampos(aba) {
  const obrigatorios = ['ID Rota', 'Origem', 'Destino', 'Rota', 'IO Nível Alto', 'ID Digital LSH', 'Ordem de Recebimento']
  const fim = XLSX.utils.decode_range(aba['!ref']).e.c
  const colunas = {}
  for (let c = 0; c <= fim; c++) {
    const nome = String(aba[XLSX.utils.encode_cell({ c, r: 7 })]?.v ?? '').trim()
    if (!obrigatorios.includes(nome)) continue
    if (Object.hasOwn(colunas, nome)) throw new Error('Cabeçalho duplicado em Recebimento: ' + nome)
    colunas[nome] = c
  }
  for (const nome of obrigatorios) {
    if (!Object.hasOwn(colunas, nome)) throw new Error('Cabeçalho ausente em Recebimento: ' + nome)
  }
  return colunas
}

function lerRotaRecebimento(raiz, caminho) {
  const { aba, valor } = abrirLir(raiz, caminho, abaRecebimento, mapearCampos)
  const fim = XLSX.utils.decode_range(aba['!ref']).e.r
  const linhas = []
  for (let r = 8; r <= fim; r++) {
    if (valor('Origem', r) === 'RG01' && valor('Destino', r) === 'MG01' &&
        valor('Rota', r).replace(/\s+/g, '') === 'RG01->RG03->RG04->RG22->MG01') linhas.push(r)
  }
  if (linhas.length !== 1) throw new Error('A rota RG01->RG03->RG04->RG22->MG01 precisa ter um cadastro único na aba de Recebimento.')
  const [r] = linhas
  const codigo = valor('ID Rota', r)
  const ordem = valor('Ordem de Recebimento', r)
  if (!/^\d+$/.test(codigo) || Number(codigo) < 1 || Number(codigo) > 32767 || ordem !== '9390') {
    throw new Error('Confira o ID da rota e a ordem 9390 na linha ' + (r + 1) + ' da aba de Recebimento.')
  }
  const ioTexto = valor('IO Nível Alto', r)
  const digitalTexto = valor('ID Digital LSH', r)
  const io = ioTexto === '---' ? '' : ioTexto
  const digital = digitalTexto === '---' ? '' : digitalTexto
  if (Boolean(io) !== Boolean(digital) || (digital && (!/^\d+$/.test(digital) || !Number.isSafeInteger(Number(digital))))) {
    throw new Error('Confira o par IO Nível Alto e ID Digital LSH na linha ' + (r + 1) + '.')
  }
  return {
    codigo, ordem, origem: valor('Origem', r), destino: valor('Destino', r), rota: valor('Rota', r),
    nivelAlto: { io: io || null, idDigital: digital ? Number(digital) : null, aplicavel: Boolean(io) },
  }
}

module.exports = { lerRotaRecebimento }
