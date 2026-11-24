import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { CatalogStore } from '../catalog-store.mjs';
import { ioAddress, scanIoTags } from '../io-import.mjs';
import { importTiaDatabase } from '../tia-import.mjs';
import { matchesEntry } from '../catalog-filter.js';

const stream = text => Readable.from([Buffer.from(text)]);
const catalog = [{ block: 'DB5', name: 'Ligado', type: 'Bool', dbNumber: 5, offsetBits: 0 }];

test('cache por conteúdo persiste fonte/catálogo, não repete parser e permite escolher/remover versão', async () => {
  const directory = await mkdtemp(join(tmpdir(), 's7-cache-'));
  let calls = 0;
  const parser = async source => { for await (const chunk of source) {} calls++; return catalog; };
  try {
    const store = new CatalogStore(directory, parser);
    const first = await store.import(stream('projeto A'), 'Primeiro');
    assert.equal(first.cached, false);
    const reused = await store.import(stream('projeto A'), 'Mesmo conteúdo');
    assert.equal(reused.cached, true);
    assert.equal(reused.catalogo.id, first.catalogo.id);
    assert.equal(calls, 1);
    assert.equal(await readFile(join(directory, first.catalogo.id + '.plf'), 'utf8'), 'projeto A');
    const second = await store.import(stream('projeto B'), 'Segundo');
    assert.equal(calls, 2);
    const restarted = new CatalogStore(directory, () => { throw new Error('Não deve fazer varredura na reabertura'); });
    assert.equal((await restarted.current()).catalogo.id, second.catalogo.id);
    assert.equal((await restarted.list()).length, 2);
    assert.deepEqual((await restarted.select(first.catalogo.id)).arrays, catalog);
    await restarted.remove(second.catalogo.id);
    assert.equal((await restarted.current()).catalogo.id, first.catalogo.id);
    await restarted.remove(first.catalogo.id);
    assert.equal((await restarted.current()).catalogo, null);
    assert.equal((await restarted.list()).length, 0);
    await assert.rejects(stat(join(directory, first.catalogo.id + '.plf')), { code: 'ENOENT' });
    await assert.rejects(restarted.select('../active'), /inválido/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('falha de importação preserva catálogo anterior e importações concorrentes não repetem a varredura', async () => {
  const directory = await mkdtemp(join(tmpdir(), 's7-cache-race-'));
  let calls = 0;
  const store = new CatalogStore(directory, async source => {
    let text = ''; for await (const chunk of source) text += chunk;
    calls++;
    if (text === 'inválido') throw new Error('Projeto inválido');
    return catalog;
  });
  try {
    const [a, b] = await Promise.all([store.import(stream('válido')), store.import(stream('válido'))]);
    assert.equal(calls, 1); assert.equal(b.cached, true);
    await assert.rejects(store.import(stream('inválido')), /Projeto inválido/);
    assert.equal((await store.current()).catalogo.id, a.catalogo.id);
    await writeFile(join(directory, a.catalogo.id + '.json'), 'json danificado');
    await assert.rejects(store.current(), SyntaxError);
    const repaired = await store.import(stream('válido'));
    assert.equal(repaired.cached, false);
    assert.equal((await store.current()).catalogo.id, a.catalogo.id);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('filtros combinam palavras sem acento, área, bloco, tipo e endereço', () => {
  const entry = { block: 'Entradas (I)', name: 'LSH_MG14', type: 'Bool', address: 'I34.6', tiaAddress: '%I34.6', io: true, area: 'I' };
  const filters = { query: 'entradas mg14 i34.6', classify: t => t.type.toUpperCase(), area: 'I', type: 'BOOL' };
  assert.equal(matchesEntry(entry, filters), true);
  assert.equal(matchesEntry(entry, { ...filters, query: 'SAÍDAS' }), false);
  assert.equal(matchesEntry(entry, { ...filters, area: 'Q' }), false);
  assert.equal(matchesEntry({ block: 'Balança', name: 'Peso', type: 'Real', dbNumber: 5 }, { query: 'balanca DB5', classify: () => '' }), true);
});

test('I/O utiliza tipo declarado e valida largura, bit e limite de endereço', () => {
  assert.deepEqual(ioAddress('%I34.6', 'Bool'), { area: 'I', address: 'I34.6' });
  assert.deepEqual(ioAddress('%QW20', 'Int'), { area: 'Q', address: 'QI20' });
  assert.deepEqual(ioAddress('%ID32', 'Real'), { area: 'I', address: 'IR32' });
  assert.equal(ioAddress('%I34.8', 'Bool'), null);
  assert.equal(ioAddress('%IW34', 'Bool'), null);
  assert.equal(ioAddress('%ID32', 'Int'), null);
  assert.equal(ioAddress('%I2097152.0', 'Bool'), null);
});

// Bounded PLC-tag record from the supplied PEData sample, independent of a DB layout.
const plcRecord = Buffer.from('B1M3MTUwMAclSTM0LjZjAAAAOAAAADkAAAAAAQEAAAAAAAcAAAABAAAA/////wAAAAAAAAAAADhNJRkAAEAAAAAAPgAAAAEFQm9vbCUADAAAAAAAAAAAAAAAABABAAAAAQEAAAAMAAAAAAAAAAwAAABiAAAAJwAAAADqk454Dt9IAADF3+aAeQ7fSB4AAAAJTFNIX01HMTQ7OgAAACoAAAD/////AQAA', 'base64');
test('importa símbolo de I/O observado no PEData, inclusive separado entre chunks', async () => {
  const rows = await importTiaDatabase(Readable.from([Buffer.alloc(1024 * 1024 - 8), plcRecord.subarray(0, 8), plcRecord.subarray(8)]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'LSH_MG14');
  assert.equal(rows[0].address, 'I34.6');
  assert.equal(rows[0].io, true);
  const damaged = Buffer.from(plcRecord);
  damaged[7] = 20; // Address length no longer matches the typed record.
  const invalid = []; scanIoTags(damaged.toString('latin1'), row => invalid.push(row));
  assert.equal(invalid.length, 0);
});
test('conflito entre versões do mesmo símbolo não publica endereço arbitrário', async () => {
  const conflicting = Buffer.from(plcRecord.toString('latin1').replace('%I34.6', '%I35.6'), 'latin1');
  await assert.rejects(importTiaDatabase(Readable.from([plcRecord, conflicting])), /Nenhuma declaração/);
});
