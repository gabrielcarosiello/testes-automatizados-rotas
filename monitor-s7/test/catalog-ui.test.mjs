import { writableType, writeTypes, writeArea } from '../write-policy.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { dbType, selectableTypes } from '../db-types.js';
import { matchesEntry, searchable, entryArea, normalized } from '../catalog-filter.js';

async function waitFor(check) {
  const end = Date.now() + 2000;
  while (!check()) { if (Date.now() > end) throw new Error('A interface não concluiu a ação'); await new Promise(r => setTimeout(r, 10)); }
}

test('interface restaura catálogo, pagina, pesquisa I/O, mapeia leitura e troca/remove versões', async t => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:3000', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const byId = id => window.document.getElementById(id);
  Object.assign(window, { dbType, selectableTypes, matchesEntry, searchable, entryArea, normalized, writableType, writeTypes, writeArea });
  const io = { block: 'Entradas (I)', name: 'LSH_MG14', type: 'Bool', area: 'I', io: true, address: 'I34.6', tiaAddress: '%I34.6' };
  const data = { catalogo: { id: 'teste1', name: 'Projeto', createdAt: new Date().toISOString() }, arrays: [
    ...Array.from({ length: 450 }, (_, i) => ({ block: 'Dados', name: 'Tag' + i, type: 'Int', dbNumber: 5, offsetBits: i * 16 })), io,
  ] };
  const calls = [];
  let removed = false;
  window.confirm = () => true;
  window.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    const result = url.endsWith('catalogos') ? { catalogos: removed ? [] : [data.catalogo] } : url.endsWith('remover') ? { removed: true } : data;
    if (url.endsWith('remover')) removed = true;
    return { ok: true, json: async () => structuredClone(result) };
  };
  const script = readFileSync(new URL('../tia-panel.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/gm, '');
  window.eval(script);
  await waitFor(() => byId('tia-catalog').value === 'teste1');
  assert.equal(byId('tia-array').options.length, 200);
  assert.match(byId('tia-results').textContent, /200 de 451/);
  byId('tia-more').click(); assert.equal(byId('tia-array').options.length, 400);
  byId('tia-area').value = 'I'; byId('tia-area').dispatchEvent(new window.Event('change'));
  byId('tia-query').value = 'lsh mg14 i34.6'; byId('tia-query').dispatchEvent(new window.Event('input'));
  await waitFor(() => byId('tia-array').options.length === 1);
  assert.match(byId('tia-array').selectedOptions[0].textContent, /LSH_MG14/);
  assert.equal(byId('tia-db').disabled, true);
  byId('tia-select').requestSubmit();
  assert.match(byId('mapping').value, /io_i34_6 \| LSH_MG14 \| I34.6/);
  byId('tia-area').value = 'Q'; byId('tia-area').dispatchEvent(new window.Event('change'));
  assert.equal(byId('tia-array').options.length, 0);
  assert.equal(byId('tia-add').disabled, true);
  byId('tia-clear-filters').click();
  assert.equal(byId('tia-area').value, '');
  assert.equal(byId('tia-array').options.length, 200);
  byId('tia-load-catalog').click(); await waitFor(() => calls.some(c => c.url.endsWith('selecionar')));
  await new Promise(r => setTimeout(r, 0));
  byId('tia-remove-catalog').click(); await waitFor(() => byId('tia-select').hidden);
  assert.ok(calls.some(c => c.url.endsWith('remover')));
});

test('monitor combina pesquisa por palavras, área e qualidade de leitura', async t => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:3000', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const byId = id => window.document.getElementById(id);
  Object.assign(window, { normalized, writeTypes, writeArea, selectedTags: () => [] });
  window.fetch = async () => ({ ok: true, json: async () => ({ mode: 's7', state: 'ok', connected: true, host: '127.0.0.2', sequence: 1, receivedAt: new Date().toISOString(), tags: [
    { id: 'peso', label: 'Balança principal', address: 'DB5,REAL0', value: 12.5, good: true },
    { id: 'lsh', label: 'LSH MG14', address: 'I34.6', value: true, good: true },
    { id: 'motor', label: 'Motor', address: 'Q24.7', value: null, good: false },
  ] }) });
  window.eval(readFileSync(new URL('../panel.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/gm, ''));
  await waitFor(() => byId('tag-cards').querySelectorAll('[data-tag]').length === 3);
  byId('filter').value = 'balanca DB5'; byId('filter').dispatchEvent(new window.Event('input'));
  assert.equal(byId('tag-cards').querySelectorAll('[data-tag]').length, 1);
  assert.equal(byId('tag-cards').querySelector('[data-tag]').dataset.tag, 'peso');
  byId('filter').value = ''; byId('filter').dispatchEvent(new window.Event('input'));
  byId('monitor-area').value = 'I'; byId('monitor-area').dispatchEvent(new window.Event('change'));
  assert.equal(byId('tag-cards').querySelector('[data-tag]').dataset.tag, 'lsh');
  byId('monitor-quality').value = 'bad'; byId('monitor-quality').dispatchEvent(new window.Event('change'));
  assert.equal(byId('tag-cards').querySelectorAll('[data-tag]').length, 0);
  byId('monitor-area').value = 'Q'; byId('monitor-area').dispatchEvent(new window.Event('change'));
  assert.equal(byId('tag-cards').querySelector('[data-tag]').dataset.tag, 'motor');
});

test('permissão de escrita de entrada é selecionável por ponto e desmarcar Monitorar a remove', () => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:3000', runScripts: 'outside-only' });
  try {
    const { window } = dom;
    Object.assign(window, { dbType, selectableTypes, writableType });
    const source = readFileSync(new URL('../tag-selection.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/gm, '').replace('export function selectedTags', 'function selectedTags');
    window.eval(source);
    const mapping = window.document.getElementById('mapping'); mapping.value = 'lsh | LSH_MG14 | I34.6'; mapping.dispatchEvent(new window.Event('input'));
    const permission = window.document.querySelector('[aria-label="Permitir escrita: lsh"]');
    assert.equal(permission.disabled, false); assert.equal(permission.checked, false);
    permission.click(); assert.equal(window.eval('selectedTags()[0].writable'), true);
    window.document.querySelector('[aria-label="Monitorar: lsh"]').click();
    assert.equal(window.document.querySelector('[aria-label="Permitir escrita: lsh"]').disabled, true);
    assert.equal(window.eval('selectedTags().length'), 0);
  } finally { dom.window.close(); }
});

test('BOOL aciona/desaciona sem modal, bloqueia clique duplicado e usa sessão/expected', async t => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:3000', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.assign(window, { normalized, writeTypes, selectedTags: () => [] });
  const commands = [];
  let value = false, sequence = 1;
  window.confirm = () => { throw new Error('Não deve abrir confirmação'); };
  window.fetch = async (url, options) => {
    if (url === '/api/escrita') {
      const command = JSON.parse(options.body); commands.push(command);
      await new Promise(resolve => setTimeout(resolve, 30));
      value = command.value; sequence++;
      return { ok: true, json: async () => ({ acknowledged: true, verified: true, observed: value, address: 'I34.6', sequence, receivedAt: new Date().toISOString() }) };
    }
    return { ok: true, json: async () => ({ mode: 's7', state: 'ok', connected: true, connection: 'sessao:0', host: '127.0.0.1', sequence, receivedAt: new Date().toISOString(),
      tags: [{ id: 'lsh', label: 'LSH_MG14', address: 'I34.6', writeType: 'X', good: true, value }] }) };
  };
  window.eval(readFileSync(new URL('../panel.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/gm, ''));
  await waitFor(() => window.document.querySelector('.write-button'));
  assert.equal(window.document.querySelector('#write-dialog'), null);
  const button = window.document.querySelector('.write-button'); assert.equal(button.textContent, 'Aciona');
  button.click(); button.click();
  assert.equal(window.document.querySelector('.write-button').disabled, true);
  await waitFor(() => window.document.querySelector('.write-button').textContent === 'Desaciona');
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0], { id: 'lsh', connection: 'sessao:0', expected: false, value: true });
  window.document.querySelector('#view-table').click();
  assert.equal(window.document.querySelector('#tag-table .write-button').textContent, 'Desaciona');
  window.document.querySelector('#tag-table .write-button').click();
  await waitFor(() => window.document.querySelector('#tag-table .write-button').textContent === 'Aciona');
  assert.deepEqual(commands[1], { id: 'lsh', connection: 'sessao:0', expected: true, value: false });
});

test('valor não confirmado não troca BOOL artificialmente e erro permite nova tentativa manual', async t => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:3000', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.assign(window, { normalized, writeTypes, selectedTags: () => [] });
  let writes = 0;
  window.fetch = async url => {
    if (url === '/api/escrita') { writes++; return { ok: writes === 1, json: async () => writes === 1 ? { acknowledged: true, verified: false, observed: false } : { error: 'Leitura mudou' } }; }
    return { ok: true, json: async () => ({ mode: 's7', state: 'ok', connected: true, connection: 's:0', sequence: 1, receivedAt: new Date().toISOString(),
      tags: [{ id: 'lsh', label: 'LSH', address: 'I34.6', writeType: 'X', good: true, value: false }] }) };
  };
  window.eval(readFileSync(new URL('../panel.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/gm, ''));
  await waitFor(() => window.document.querySelector('.write-button'));
  window.document.querySelector('.write-button').click();
  await waitFor(() => window.document.querySelector('.write-feedback')?.textContent.includes('não confirmado'));
  assert.equal(window.document.querySelector('.write-button').textContent, 'Aciona');
  window.document.querySelector('.write-button').click();
  await waitFor(() => window.document.querySelector('.write-feedback')?.textContent.includes('Leitura mudou'));
  assert.equal(writes, 2); assert.equal(window.document.querySelector('.write-button').disabled, false);
});

test('escrita numérica é inline, preserva valor digitado e valida faixa antes de enviar', async t => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://127.0.0.1:3000', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.assign(window, { normalized, writeTypes, selectedTags: () => [] });
  const commands = [];
  window.fetch = async (url, options) => {
    if (url === '/api/escrita') { commands.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ acknowledged: true, verified: true, observed: 123, address: 'QW40', sequence: 2, receivedAt: new Date().toISOString() }) }; }
    return { ok: true, json: async () => ({ mode: 's7', state: 'ok', connected: true, connection: 's:0', sequence: 1, receivedAt: new Date().toISOString(), tags: [{ id: 'palavra', label: 'Palavra', address: 'QW40', good: true, value: 0, writeType: 'WORD' }] }) };
  };
  window.eval(readFileSync(new URL('../panel.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/gm, ''));
  await waitFor(() => window.document.querySelector('.write-number-inline'));
  let input = window.document.querySelector('.write-number-inline'); input.value = '65536'; input.dispatchEvent(new window.Event('input'));
  window.document.querySelector('.write-button').click();
  assert.equal(commands.length, 0);
  input = window.document.querySelector('.write-number-inline'); assert.equal(input.value, '65536'); input.value = '123'; input.dispatchEvent(new window.Event('input'));
  window.document.querySelector('.write-button').click();
  await waitFor(() => window.document.querySelector('.write-feedback')?.textContent.includes('Releitura'));
  assert.deepEqual(commands[0], { id: 'palavra', connection: 's:0', expected: 0, value: 123 });
  assert.equal(window.document.querySelector('#write-dialog'), null);
});
