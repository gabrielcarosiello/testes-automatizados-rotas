'use strict'
const fs = require('node:fs')
const path = require('node:path')

function lerSenhaMes(raiz, senhaConfigurada) {
  if (typeof senhaConfigurada === 'string' && senhaConfigurada.trim()) return { senha: senhaConfigurada }
  const arquivo = path.join(raiz, 'credenciais.local.json')
  let bytes
  try {
    bytes = fs.readFileSync(arquivo)
  } catch (erro) {
    if (erro.code === 'ENOENT') return { erro: 'Senha MES ausente. Crie ' + arquivo + ' com a chave senhaMES. credenciais.exemplo.json é apenas o modelo.' }
    return { erro: 'Falha ao ler ' + arquivo + ' (' + (erro.code || 'erro de leitura') + '). Confira o acesso pela conta que executa o Cypress.' }
  }
  let credenciais
  try {
    const marca = bytes.length >= 2 ? bytes.readUInt16LE(0) : 0
    const texto = marca === 0xfeff ? bytes.toString('utf16le', 2) :
      marca === 0xfffe ? bytes.subarray(2).swap16().toString('utf16le') :
        bytes.toString('utf8').replace(/^\uFEFF/, '')
    credenciais = JSON.parse(texto)
  } catch {
    return { erro: 'JSON inválido em ' + arquivo + '. Confira se o arquivo contém a chave senhaMES.' }
  }
  if (typeof credenciais?.senhaMES !== 'string' || !credenciais.senhaMES.trim()) {
    return { erro: 'A chave senhaMES está ausente ou vazia em ' + arquivo + '.' }
  }
  return { senha: credenciais.senhaMES }
}

module.exports = { lerSenhaMes }
