const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { gravarEvento } = require('../../comum/registro-execucao')

function tarefasEvidenciasOrdem(raiz, senha) {
  return {
    iniciarEvidenciaOrdem({ item } = {}) {
      const pasta = 'Ordem_Recebimento_' + randomUUID()
      fs.mkdirSync(path.join(raiz, 'resultados', pasta), { recursive: true })
      gravarEvento(raiz, pasta, 'inicio', { item })
      return pasta
    },
    registrarEvidenciaOrdem({ pasta, etapa, numero, resultado, erro, item, confirmadaNaLista }) {
      const mensagem = typeof erro === 'string' && erro ?
        etapa === 'Login' ? 'Falha no acesso ao MES. Confira a tela de login e a configuração local.' :
          (senha ? erro.split(senha).join('[oculto]') : erro).slice(0, 4000) : null
      gravarEvento(raiz, pasta, resultado ? 'resultado' : 'etapa', { etapa, numero, resultado, item, confirmadaNaLista, erro: mensagem })
      return null
    },
  }
}

module.exports = { tarefasEvidenciasOrdem }
