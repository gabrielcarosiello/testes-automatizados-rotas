'use strict'
const { setTimeout: esperar } = require('node:timers/promises')
function criarClienteMonitor(monitor, { fetchImpl = fetch, pausa = esperar, timeoutPadrao = 5000 } = {}) {
  return async function chamar(caminho, { body, contentType, timeout = timeoutPadrao } = {}) {
    const url = new URL(caminho, monitor), metodo = body === undefined ? 'GET' : 'POST'
    // Só consultas são repetidas. POST pode ter sido aplicado mesmo sem resposta.
    const tentativas = metodo === 'GET' ? 2 : 1
    const pausaMs = Math.min(250, Math.floor(timeout / 10))
    const timeoutTentativa = Math.max(1, Math.floor((timeout - pausaMs * (tentativas - 1)) / tentativas))
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      let resposta
      try {
        resposta = await fetchImpl(url, { method: metodo, headers: metodo === 'GET' ? {} : { Origin: monitor.origin, 'Content-Type': contentType || 'application/json' }, body, signal: AbortSignal.timeout(timeoutTentativa), redirect: 'error' })
      } catch (causa) {
        if (tentativa < tentativas) { await pausa(pausaMs); continue }
        const codigo = causa.cause?.code || causa.code || causa.name || 'ERRO_REDE'
        throw new Error(`Monitor: ${metodo} ${url.href} falhou (${codigo}; limite ${timeout} ms; ${tentativa} tentativa(s)). Confira se o Monitor está aberto e a URL/porta estão corretas.${metodo === 'POST' ? ' O comando pode ter sido aplicado; não foi repetido.' : ''}`, { cause: causa })
      }
      let dados
      try { dados = await resposta.json() } catch { throw Object.assign(new Error(`Monitor: ${metodo} ${url.href}: HTTP ${resposta.status}, resposta JSON inválida.`), { status: resposta.status }) }
      if (!resposta.ok && !(caminho === '/api/tags' && resposta.status === 503)) throw Object.assign(new Error(`Monitor: ${metodo} ${url.href}: HTTP ${resposta.status}: ${dados.error || 'falha na API'}`), { status: resposta.status })
      return dados
    }
  }
}
module.exports = { criarClienteMonitor }
