const { test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { once } = require('node:events')
const { criarClienteMonitor } = require('./cliente-monitor')
async function servidor(t, handler) {
  const s = http.createServer(handler); s.listen(0, '127.0.0.1'); await once(s, 'listening')
  t.after(() => new Promise(resolve => { s.close(resolve); s.closeAllConnections() }))
  return new URL(`http://127.0.0.1:${s.address().port}`)
}
test('API real: GET recupera interrupção transitória sem repetir POST', async t => {
  let gets = 0, posts = 0
  const url = await servidor(t, (req, res) => {
    if (req.method === 'POST') { posts++; req.socket.destroy(); return }
    if (++gets === 1) { req.socket.destroy(); return }
    res.end('{"catalogo":"ok"}')
  })
  const chamar = criarClienteMonitor(url, { pausa: async () => {} })
  assert.deepEqual(await chamar('/api/tia/catalogo'), { catalogo: 'ok' }); assert.equal(gets, 2)
  await assert.rejects(chamar('/api/escrita', { body: '{}' }), /POST.*api\/escrita.*não foi repetido/)
  assert.equal(posts, 1)
})
test('porta fechada informa endereço, operação e causa; não devolve fetch failed isolado', async t => {
  const s = http.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening')
  const url = new URL(`http://127.0.0.1:${s.address().port}`); await new Promise(r => s.close(r))
  await assert.rejects(criarClienteMonitor(url, { pausa: async () => {} })('/api/tia/catalogo'), /GET http:.*api\/tia\/catalogo.*ECONNREFUSED/)
})
test('timeout real é limitado e HTTP/JSON inválido permanece diagnóstico distinto', async t => {
  const url = await servidor(t, (req, res) => {
    if (req.url === '/lento') return
    if (req.url === '/api/diagnostico-dbs') { res.writeHead(405); res.end(); return }
    if (req.url === '/html') { res.end('<html>Erro</html>'); return }
    res.writeHead(req.url === '/api/tags' ? 503 : 404); res.end('{"error":"não conectado"}')
  })
  const chamar = criarClienteMonitor(url, { pausa: async () => {}, timeoutPadrao: 40 })
  await assert.rejects(chamar('/lento'), /limite 40 ms/)
  await assert.rejects(chamar('/html'), /JSON inválida/)
  await assert.rejects(chamar('/api/diagnostico-dbs', { body: '{}' }), e => e.status === 405 && /JSON inválida/.test(e.message))
  await assert.rejects(chamar('/ausente'), e => e.status === 404)
  assert.equal((await chamar('/api/tags')).error, 'não conectado')
})
