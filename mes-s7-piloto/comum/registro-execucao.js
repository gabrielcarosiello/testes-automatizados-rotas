'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
function gravarEvento(raiz, pasta, tipo, dados) {
  if (typeof pasta !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(pasta)) throw new Error('Pasta de registro inválida.')
  const diretorio = path.join(raiz, 'resultados', pasta)
  if (!fs.statSync(diretorio).isDirectory()) throw new Error('Diretório de execução inexistente.')
  const evento = { id: randomUUID(), data: new Date().toISOString(), tipo, dados }
  const fd = fs.openSync(path.join(diretorio, 'eventos.jsonl'), 'a')
  try { fs.writeFileSync(fd, JSON.stringify(evento) + '\n'); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  return evento.id
}
function classificarFalha(dados) {
  if (dados.resultado === 'Concluída') return 'aprovado'
  const texto = `${dados.etapa || ''} ${dados.detalhes || ''}`.toLowerCase()
  if (/restaura.*pendente|restaura.*não confirmada/.test(texto)) return 'recuperacao-pendente'
  if (/partida recusada|já indica nível alto/.test(texto)) return 'condicao-pre-existente'
  if (/monitor:|fetch failed|conexão|conexao|sql|econn|timeout/.test(texto)) return 'comunicacao-ou-infraestrutura'
  if (/botão|botao|cartão|cartao|dropdown|campo de busca|opção/.test(texto)) return 'interface'
  if (/esperado|lido|prazo para confirmar|equipamento/.test(texto)) return 'divergencia-de-processo'
  return 'revisar'
}
module.exports = { gravarEvento, classificarFalha }
