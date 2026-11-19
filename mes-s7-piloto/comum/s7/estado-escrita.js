'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
function criarEstadoEscrita(raiz, alvo) {
  const arquivo = path.join(raiz, 'resultados', 'controle', 'escrita-pendente.json')
  function ler() {
    try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')) } catch (e) { if (e.code === 'ENOENT') return null; throw new Error(`Não foi possível conferir escrita pendente em ${arquivo}: ${e.message}`) }
  }
  function exigirLivre() {
    const pendente = ler()
    if (pendente) throw new Error(`Restauração pendente registrada em disco: ${pendente.address} no CLP ${pendente.host}, original=${Number(pendente.original)}. Confira o sinal e siga docs/PILOTO_11_ESTABILIDADE.md antes de liberar outra rota. Arquivo: ${arquivo}`)
  }
  function registrar(fase, c) {
    const anterior = ler()
    if (fase !== 'solicitada' && anterior?.owner !== c.nivel.id) throw new Error('Registro pendente pertence a outra escrita ou está ausente; não será removido.')
    if (fase === 'restaurada') { fs.unlinkSync(arquivo); return }
    if (fase === 'solicitada' && anterior) throw new Error('Já existe escrita pendente em disco; novo acionamento bloqueado.')
    const dados = { versao: 1, owner: c.nivel.id, ...alvo, codigo: c.codigo, address: c.lsh.address, original: c.lsh.valorInicial, destino: c.nivel.valorSolicitado, fase, atualizadoEm: new Date().toISOString(), ...(anterior ? { criadaEm: anterior.criadaEm } : { criadaEm: new Date().toISOString() }) }
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    if (fase === 'solicitada') {
      const fd = fs.openSync(arquivo, 'wx')
      try { fs.writeFileSync(fd, JSON.stringify(dados, null, 2)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      return
    }
    const temporario = arquivo + '.' + randomUUID() + '.tmp'
    try {
      const fd = fs.openSync(temporario, 'wx')
      try { fs.writeFileSync(fd, JSON.stringify(dados, null, 2)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      fs.renameSync(temporario, arquivo)
    } finally { if (fs.existsSync(temporario)) fs.unlinkSync(temporario) }
  }
  return { ler, exigirLivre, registrar, arquivo }
}
module.exports = { criarEstadoEscrita }
