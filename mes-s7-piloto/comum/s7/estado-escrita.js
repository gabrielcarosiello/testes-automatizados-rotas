'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const atrasosRename = [25, 50, 100]
const codigosRename = new Set(['EPERM', 'EACCES', 'EBUSY'])

function aguardar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function criarEstadoEscrita(raiz, alvo, { arquivos = fs, esperar = aguardar } = {}) {
  const arquivo = path.join(raiz, 'resultados', 'controle', 'escrita-pendente.json')

  function ler() {
    try {
      const pendente = JSON.parse(arquivos.readFileSync(arquivo, 'utf8'))
      if (pendente?.versao !== 1 || typeof pendente.owner !== 'string' ||
          typeof pendente.address !== 'string' || typeof pendente.original !== 'boolean' ||
          !['solicitada', 'confirmada'].includes(pendente.fase)) throw new Error('Registro inválido')
      return pendente
    } catch (causa) {
      if (causa.code === 'ENOENT') return null
      throw new Error(`Não foi possível conferir escrita pendente em ${arquivo} (${causa.code || 'JSON inválido'}).`, { cause: causa })
    }
  }

  function exigirLivre() {
    const pendente = ler()
    if (pendente) throw new Error(`Restauração pendente registrada em disco: ${pendente.address} no CLP ${pendente.host}, original=${Number(pendente.original)}. Confira o sinal e siga docs/PILOTO_11_ESTABILIDADE.md antes de liberar outra rota. Arquivo: ${arquivo}`)
  }

  function exigirPropriedade(c) {
    const pendente = ler()
    if (!pendente || pendente.owner !== c.nivel.id) {
      throw new Error('Registro pendente pertence a outra escrita ou está ausente; confira a restauração antes de liberar o ensaio.')
    }
    return pendente
  }

  function gravarExclusivo(destino, dados) {
    const fd = arquivos.openSync(destino, 'wx')
    try {
      arquivos.writeFileSync(fd, JSON.stringify(dados, null, 2))
      arquivos.fsyncSync(fd)
    } finally {
      arquivos.closeSync(fd)
    }
  }

  function substituir(temporario, c) {
    for (let tentativa = 0; ; tentativa++) {
      exigirPropriedade(c)
      try {
        arquivos.renameSync(temporario, arquivo)
        return
      } catch (causa) {
        if (codigosRename.has(causa.code) && tentativa < atrasosRename.length) {
          esperar(atrasosRename[tentativa])
          continue
        }
        throw new Error(`Persistência S7 (confirmada): rename falhou (${causa.code}) após ${tentativa + 1} tentativa(s). Registro: ${arquivo}. Temporário: ${temporario}. Confira permissões de substituição, atributo somente leitura e processos com arquivos abertos.`, { cause: causa })
      }
    }
  }

  function registrar(fase, c) {
    const anterior = fase === 'solicitada' ? null : exigirPropriedade(c)
    if (fase === 'restaurada') {
      try {
        arquivos.unlinkSync(arquivo)
      } catch (causa) {
        throw new Error(`Persistência S7 (restaurada): unlink falhou (${causa.code}). Registro: ${arquivo}.`, { cause: causa })
      }
      return
    }

    const agora = new Date().toISOString()
    const dados = { versao: 1, owner: c.nivel.id, ...alvo, codigo: c.codigo, address: c.lsh.address, original: c.lsh.valorInicial, destino: c.nivel.valorSolicitado, fase, atualizadoEm: agora, criadaEm: anterior?.criadaEm ?? agora }
    if (fase === 'solicitada') {
      try {
        arquivos.mkdirSync(path.dirname(arquivo), { recursive: true })
        gravarExclusivo(arquivo, dados)
      } catch (causa) {
        if (causa.code === 'EEXIST') throw new Error(`Já existe escrita pendente em disco; novo acionamento bloqueado. Arquivo: ${arquivo}`, { cause: causa })
        throw new Error(`Persistência S7 (solicitada) falhou (${causa.syscall || 'gravação'}, ${causa.code}). Confira o registro em ${arquivo}.`, { cause: causa })
      }
      return
    }

    const temporario = arquivo + '.' + randomUUID() + '.tmp'
    try {
      gravarExclusivo(temporario, dados)
    } catch (causa) {
      throw new Error(`Persistência S7 (confirmada): falha ao preparar temporário (${causa.syscall || 'gravação'}, ${causa.code}). Registro: ${arquivo}. Temporário: ${temporario}.`, { cause: causa })
    }
    substituir(temporario, c)
  }
  return { ler, exigirLivre, exigirPropriedade, registrar, arquivo }
}
module.exports = { criarEstadoEscrita }
