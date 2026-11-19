import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writableType, writeTypes } from '../write-policy.js';
import { simulatedPeer } from './helpers/s7-simulated-peer.mjs';

test('política compartilhada aceita I/Q/M escalares e rejeita tipos, áreas e limites incorretos', () => {
  for (const [address, type] of [['I34.6', 'X'], ['Q24.7', 'X'], ['M3.2', 'X'], ['E1.0', 'X'], ['A1.0', 'X'], ['IB0', 'BYTE'], ['QW20', 'WORD'], ['QI20', 'INT'], ['MD0', 'DWORD'], ['IDI8', 'DINT'], ['IR32', 'REAL'], ['DB5,X0.1', 'X'], ['DB5,WORD0', 'WORD']]) assert.equal(writableType(address), type, address);
  for (const invalid of ['I34.8', 'I34', 'IW34.1', 'I2097152.0', 'ID2097150', 'DB0,X0.1', 'DB65536,X0.1', 'PQ1.0', 'IB0.10', 'DB5,STRING0.10', 'IB-1', null]) assert.equal(writableType(invalid), null, String(invalid));
  assert.equal(writeTypes.X.accepts(1), false);
  assert.equal(writeTypes.WORD.accepts(65535), true); assert.equal(writeTypes.WORD.accepts(65536), false);
  assert.equal(writeTypes.DWORD.accepts(4294967295), true); assert.equal(writeTypes.DWORD.accepts(-1), false);
});

test('HTTP + driver S7 real escrevem I/Q/M/DB, preservam bits vizinhos e distinguem rejeição/releitura', { timeout: 15000 }, async () => {
  const peer = await simulatedPeer();
  const portServer = createServer(); portServer.listen(0, '127.0.0.1'); await once(portServer, 'listening');
  const port = portServer.address().port; await new Promise(r => portServer.close(r));
  const directory = await mkdtemp(join(tmpdir(), 's7-write-'));
  const base = `http://127.0.0.1:${port}`;
  const processMonitor = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), MONITOR_S7_DATA_DIR: directory, MONITOR_S7_PORT: String(peer.port) } });
  try {
    await Promise.race([once(processMonitor.stdout, 'data'), once(processMonitor, 'exit').then(([code]) => { throw new Error('Monitor encerrou: ' + code); })]);
    const post = async (route, body) => { const response = await fetch(base + route, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, data: await response.json() }; };
    const tags = [
      { id: 'lsh', label: 'LSH_MG14', address: 'I34.6', writable: true },
      { id: 'saida', label: 'Saída', address: 'Q24.7', writable: true },
      { id: 'memoria', label: 'Memória', address: 'M3.2', writable: true },
      { id: 'db', label: 'Campo DB', address: 'DB5,X0.1', writable: true },
      { id: 'somenteLeitura', label: 'Outra entrada', address: 'I34.1', writable: false },
      { id: 'word', label: 'Palavra', address: 'QW40', writable: true },
    ];
    const connected = await post('/api/conexao', { host: '127.0.0.1', rack: 0, slot: 1, pollMs: 100, tags }); assert.equal(connected.status, 200);
    let snapshot;
    const deadline = Date.now() + 5000;
    do { snapshot = await (await fetch(base + '/api/tags')).json(); if (snapshot.state === 'ok') break; await new Promise(r => setTimeout(r, 20)); } while (Date.now() < deadline);
    assert.equal(snapshot.state, 'ok', snapshot.diagnostic);
    const write = (id, value, expected) => post('/api/escrita', { id, value, expected, connection: snapshot.connection });
    for (const id of ['lsh', 'saida', 'memoria', 'db']) {
      const result = await write(id, true, false);
      assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal(result.data.acknowledged, true); assert.equal(result.data.verified, true); assert.equal(result.data.observed, true);
    }
    assert.equal(peer.bytes(peer.constants.proto.area.INPUTS)[34], 0x42, 'bit 1 vizinho permanece ligado');
    assert.equal(peer.writes[0].transport, peer.constants.proto.transport.BIT);
    const word = await write('word', 65535, 0); assert.equal(word.data.verified, true);
    assert.equal((await write('word', 65536, 65535)).status, 400);
    assert.equal((await write('somenteLeitura', false, true)).status, 400);
    assert.equal((await write('lsh', false, false)).status, 400, 'expected desatualizado bloqueia escrita');
    const before = peer.writes.length;
    const changed = await post('/api/escrita', { id: 'lsh', value: false, expected: true, connection: 'outra' }); assert.equal(changed.status, 400); assert.equal(peer.writes.length, before);
    await write('lsh', false, true);
    peer.state.revertInputs = true;
    const reverted = await write('lsh', true, false);
    assert.equal(reverted.data.acknowledged, true); assert.equal(reverted.data.verified, false); assert.equal(reverted.data.observed, false);
    peer.state.rejectWrites = true;
    const denied = await write('lsh', true, false); assert.equal(denied.status, 400); assert.match(denied.data.error, /sem confirmação/);
    peer.state.rejectWrites = false; peer.state.revertInputs = false;
    const count = peer.writes.length;
    const simultaneous = await Promise.all([write('lsh', true, false), write('lsh', true, false)]);
    assert.deepEqual(simultaneous.map(result => result.status).sort(), [200, 400]);
    assert.equal(peer.writes.length, count + 1, 'não repete o comando quando já há uma escrita em andamento ou o valor mudou');
    assert.deepEqual(peer.errors, []);
  } finally {
    if (processMonitor.exitCode === null) { const closed = once(processMonitor, 'exit'); processMonitor.kill(); await closed; }
    await peer.close(); await rm(directory, { recursive: true, force: true });
  }
});
