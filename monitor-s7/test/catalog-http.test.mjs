import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('HTTP restaura catálogo após reinício e mantém contrato arrays do Cypress', async () => {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const directory = await mkdtemp(join(tmpdir(), 's7-http-cache-'));
  const base = `http://127.0.0.1:${port}`;
  let server;
  const start = async () => {
    server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), MONITOR_S7_DATA_DIR: directory } });
    await Promise.race([once(server.stdout, 'data'), once(server, 'exit').then(([code]) => { throw new Error('Falha ao iniciar: ' + code); })]);
  };
  const stop = async () => { if (server && server.exitCode === null) { const closed = once(server, 'exit'); server.kill(); await closed; } };
  const body = '<Root InterfaceGuid="00000000-0000-0000-0000-000000000001"><Member Name="Teste" Type="Bool" /><Offsets /></Root>BIVE:Dados/00000000-0000-0000-0000-000000000002';
  try {
    await start();
    const request = () => fetch(base + '/api/tia/importar', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/octet-stream', 'X-TIA-Project': 'Projeto-teste' }, body });
    const imported = await (await request()).json();
    assert.equal(imported.arrays[0].name, 'Teste'); assert.equal(imported.cached, false);
    const repeated = await (await request()).json(); assert.equal(repeated.cached, true);
    await stop(); await start();
    const restored = await (await fetch(base + '/api/tia/catalogo')).json();
    assert.equal(restored.catalogo.id, imported.catalogo.id);
    assert.deepEqual(restored.arrays, imported.arrays);
    const list = await (await fetch(base + '/api/tia/catalogos')).json(); assert.equal(list.catalogos.length, 1);
    const denied = await fetch(base + '/api/tia/remover', { method: 'POST', headers: { Origin: 'http://outro', 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(denied.status, 403);
    const unconfirmed = await fetch(base + '/api/tia/remover', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: imported.catalogo.id }) }); assert.equal(unconfirmed.status, 400);
    const removed = await fetch(base + '/api/tia/remover', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: imported.catalogo.id, confirmar: true }) }); assert.equal(removed.status, 200);
    assert.equal((await (await fetch(base + '/api/tia/catalogo')).json()).catalogo, null);
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
