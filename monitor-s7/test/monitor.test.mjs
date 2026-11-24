import { writableType, writeTypes, writeArea } from '../write-policy.js';
import { dbType, decodeExtended, extendedAddress, selectableTypes } from '../db-types.js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchesEntry, searchable, entryArea, normalized } from '../catalog-filter.js';
import { createServer } from 'node:net';
import { Readable } from 'node:stream';
import { deflateSync } from 'node:zlib';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { importTiaDatabase } from '../tia-import.mjs';

const declarations = Buffer.from(
  '<Root InterfaceGuid="00000000-0000-0000-0000-000000000001">' +
  '<Member Name="Ativo" Type="Bool" />' +
  '<Member Name="Dados" Type="Struct"><Member Name="Peso" Type="Real" /></Member>' +
  '<Member Name="Estados" Type="Array[0..10] of Bool" />' +
  '<Member Name="Valores" Type="Array[-1..2] of Int" />' +
  '<Member Name="Estendido" Type="LReal" />' +
  '<Member Name="SemDefinicao1" RID="0x92010000" />' +
  '<Member Name="SemDefinicao2" RID="0x921D0000" />' +
  '<Offsets /></Root>BIVE:DB_Misto/00000000-0000-0000-0000-000000000002'
);

test('localiza tipos mistos em PLF grande com declaração dividida entre partes', async () => {
  const chunk = Buffer.alloc(256 * 1024);
  function* database() {
    for (let index = 0; index < 132; index++) yield chunk;
    yield Buffer.concat([chunk.subarray(0, chunk.length - 12), declarations.subarray(0, 12)]);
    yield declarations.subarray(12);
  }
  const tags = await importTiaDatabase(Readable.from(database()));
  assert.deepEqual(tags.map(tag => tag.name), ['Ativo', 'Dados', 'Dados.Peso', 'Estados', 'Valores', 'Estendido', 'SemDefinicao1', 'SemDefinicao2']);
  assert.deepEqual([tags[4].first, tags[4].last, tags[4].elementType], [-1, 2, 'Int']);
  await assert.rejects(importTiaDatabase(Readable.from([Buffer.from('sem dados')])), /Nenhuma declaração/);
});

async function availablePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  await new Promise(resolve => socket.close(resolve));
  return port;
}

test('painel e API usam pasta, mapeiam endereços e mantêm permissões por tag', { timeout: 15000 }, async t => {
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'monitor-ui-'));
  const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), MONITOR_S7_DATA_DIR: cacheDirectory } });
  t.after(async () => { if (server.exitCode === null) { server.kill(); await once(server, 'exit'); } await rm(cacheDirectory, { recursive: true, force: true }); });
  const line = await Promise.race([
    once(server.stdout, 'data').then(([data]) => data.toString()),
    once(server, 'exit').then(([code]) => { throw new Error(`Servidor encerrou com código ${code}`); })
  ]);
  const packageInfo = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(line.includes(`v${packageInfo.version}`));
  const response = await fetch(base);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const dom = new JSDOM(await response.text(), { url: base, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const byId = id => window.document.getElementById(id);
  assert.ok(window.document.body.textContent.includes(`v${packageInfo.version}`));
  assert.ok(byId('tia-folder').hasAttribute('webkitdirectory'));
  assert.equal(byId('tia-zip'), null);
  assert.equal(byId('tia-xml'), null);

  const origin = { Origin: base };
  const rawPost = (type, body) => fetch(base + '/api/tia/importar', {
    method: 'POST', headers: { ...origin, 'Content-Type': type }, body
  });
  assert.equal((await rawPost('application/zip', declarations)).status, 403);
  assert.equal((await rawPost('application/octet-stream', 'sem dados')).status, 400);
  const uploads = [];
  let loaded;
  window.fetch = async (path, options = {}) => {
    if (path === '/api/tia/importar') uploads.push(options.body);
    const response = await fetch(base + path, { ...options, headers: { ...options.headers, ...origin } });
    return { ok: response.ok, json: async () => {
      const data = await response.json();
      if (response.ok && path === '/api/tia/importar') {
        data.arrays.push({ block: data.arrays[0].block, name: 'UdtAtivo',
          type: 'Bool', dbNumber: 5, suggestedOffsetBits: 34, unverifiedLayout: true });
        const block = data.arrays[0].block;
        data.arrays.push(
          { block, name: 'EqpSeg', type: 'Array[0..1] of "UDT_SegmentoEQP"', dbNumber: 5,
            first: 0, last: 1, elementType: '"UDT_SegmentoEQP"' },
          ...[['ID_Segmento', 0], ['TotalEqpSegmento', 80], ['EqpSeg[0].numEqp', 128], ['EqpSeg[1].numEqp', 208]]
            .map(([name, offsetBits]) => ({ block, name, type: 'Int', dbNumber: 5, offsetBits }))
        );
      }
      if (path === '/api/tia/importar' && loaded) setImmediate(loaded);
      return data;
    } };
  };
  Object.assign(window, { dbType, selectableTypes, matchesEntry, searchable, entryArea, normalized, writableType, writeTypes, writeArea });
  const loadScript = async path => (await (await fetch(base + path)).text()).replace(/^import[^\n]*\n/gm, '');
  window.eval(await loadScript('/tia-panel.js'));
  window.eval((await loadScript('/tag-selection.js'))
    .replace('export function selectedTags', 'function selectedTags'));
  assert.ok([...byId('manual-type').options].some(option => option.value === 'LREAL'));
  assert.ok([...byId('manual-type').options].some(option => option.value === 'WSTRING'));
  const entry = (name, bytes) => Object.assign(new Blob([bytes]), { webkitRelativePath: name });
  const folder = byId('tia-folder');
  const project = entry('Projeto/Projeto.ap16', '');
  const database = entry('Projeto/System/PEData.plf', declarations);
  Object.defineProperty(folder, 'files', { configurable: true, value: [project] });
  byId('tia-open-folder').click();
  assert.match(byId('tia-status').textContent, /pasta principal/);
  Object.defineProperty(folder, 'files', { value: [project, database] });
  const completed = new Promise(resolve => { loaded = resolve; });
  byId('tia-open-folder').click();
  await completed;
  assert.deepEqual(uploads, [database]);
  assert.equal(byId('tia-select').hidden, false);

  function pick(name) {
    const selector = byId('tia-array');
    selector.value = [...selector.options].find(option => option.text.includes(name)).value;
    selector.dispatchEvent(new window.Event('change'));
  }

  pick('Dados · Struct');
  assert.equal(byId('tia-enter').hidden, false);
  byId('tia-enter').click();
  assert.match(byId('tia-array').selectedOptions[0].text, /Peso · Real/);
  byId('tia-up').click();
  assert.match(byId('tia-array').selectedOptions[0].text, /Dados · Struct/);
  pick('Valores');
  byId('tia-db').value = '5';
  byId('tia-offset').value = '8';
  byId('tia-stride').value = '2';
  byId('tia-first').value = '0';
  byId('tia-last').value = '1';
  byId('tia-select').requestSubmit();
  assert.match(byId('mapping').value, /DB5,INT10/);
  assert.match(byId('mapping').value, /DB5,INT12/);
  const selected = [...byId('selection-list').querySelectorAll('input[type=checkbox]')];
  assert.equal(selected.length, 4);
  assert.equal(selected[1].checked, false);
  selected[2].click();
  assert.equal(window.eval('selectedTags().length'), 1);
  const typeFilter = byId('tia-type-filter');
  assert.equal([...typeFilter.options].filter(option => option.value === 'ESTRUTURA SEM DEFINIÇÃO').length, 1);
  assert.ok([...typeFilter.options].every(option => !option.value.includes('0X')));
  typeFilter.value = 'ESTRUTURA SEM DEFINIÇÃO';
  typeFilter.dispatchEvent(new window.Event('change'));
  assert.equal(byId('tia-array').options.length, 2);
  assert.match(byId('tia-type').textContent, /0x92010000/);
  typeFilter.value = 'LREAL';
  typeFilter.dispatchEvent(new window.Event('change'));
  assert.equal(byId('tia-array').options.length, 1);
  assert.match(byId('tia-array').options[0].text, /Estendido/);
  typeFilter.value = '';
  typeFilter.dispatchEvent(new window.Event('change'));
  pick('Estendido');
  assert.equal(byId('tia-add').disabled, false);

  pick('UdtAtivo');
  assert.equal(byId('tia-offset').value, '4.2');
  assert.match(byId('tia-type').textContent, /Offset sugerido/);
  const beforeSuggestion = byId('mapping').value;
  byId('tia-select').requestSubmit();
  assert.notEqual(byId('mapping').value, beforeSuggestion);
  assert.equal(byId('tia-confirm'), null);
  byId('tia-select').requestSubmit();
  assert.match(byId('mapping').value, /DB5,X4\.2/);

  pick('EqpSeg ·');
  assert.equal(byId('tia-segment').hidden, false);
  byId('tia-segment').click();
  assert.match(byId('mapping').value, /seg5_eqp_1 .* DB5,INT26/);
  const segmentMapping = byId('mapping').value;
  byId('tia-segment').click();
  assert.equal(byId('mapping').value, segmentMapping);
  assert.equal((await fetch(base + '/api/segmentos/5')).status, 404);

  const initialResponse = await fetch(base + '/api/tags');
  assert.equal(initialResponse.status, 200);
  const initial = await initialResponse.json();
  assert.equal(initial.mode, 'demo');
  assert.deepEqual(initial.tags, []);
  assert.equal(initial.sequence, null);
  assert.equal(initial.receivedAt, null);
  assert.equal((await fetch(base + '/api/tags/clock')).status, 404);
  const denied = await fetch(base + '/api/escrita', {
    method: 'POST',
    headers: { ...origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'clock', value: true })
  });
  assert.equal(denied.status, 400);
  const config = await fetch(base + '/api/conexao', {
    method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ host: '127.0.0.1', rack: 0, slot: 1, pollMs: 200, tags: [] })
  });
  assert.equal(config.status, 200);
  const session = await config.json();
  assert.equal(session.mode, 's7');
  assert.deepEqual(session.tags, []);
  assert.equal(session.sequence, null);
  const applied = await fetch(base + '/api/mapeamento', {
    method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: [{ id: 'teste', label: 'Teste', address: 'DB5,X0.0' }] })
  });
  assert.equal(applied.status, 200);
  const mapped = await applied.json();
  assert.equal(mapped.connection.split(':')[0], session.connection.split(':')[0]);
  assert.equal(mapped.tags[0].address, 'DB5,X0.0');
  const reset = await fetch(base + '/api/simulacao', {
    method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), initial);
});

test('reconhece a referência anterior versionada e exige registro de DB correspondente', async () => {
  function interfaceRecord(block, reference, member) {
    return Buffer.concat([
      Buffer.from(`BIVE:${block}/2/${reference}`),
      Buffer.alloc(87),
      Buffer.from([1, 1, 0, 0, 0, 0xef, 0xbb, 0xbf]),
      Buffer.from(
        '<Root InterfaceGuid="00000000-0000-0000-0000-000000000001">' +
        member + '<Offsets /></Root>'
      )
    ]);
  }
  const block = 'DB_Produção';
  const member = '<Member Name="Nível" RID="0x02000008" StdO="32" />' +
    '<Member Name="Bits" RID="0x02010001" Type="Array[0..127] of Bool" />' +
    '<Member ID="51" Name="Estrutura" RID="0x92010000" SubPartIndex="1" StdO="96" />';
  const prefixed = interfaceRecord(block, '00000000-0000-0000-0000-000000000002', member);
  const unrelated = interfaceRecord('FB_Test', '00000000-0000-0000-0000-000000000003', member);
  const header = Buffer.concat([
    Buffer.from([41, 0, 0, 0]), Buffer.alloc(6), Buffer.alloc(10, 255),
    Buffer.from([41, 0, 0x0e, 0x8a, 1]), Buffer.from('Block_DB')
  ]);
  const marker = Buffer.concat([
    header,
    Buffer.from([1, 1, 1, 3, 0x44, 0x42, Buffer.byteLength(block) + 1]),
    Buffer.from(block + '! ')
  ]);
  function structure(index, xml, compressed) {
    const payload = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xml)]);
    return Buffer.concat([
      Buffer.from(`BI:${compressed ? 'Structure' : 'Struct'}${index}:${block}/2/00000000-0000-0000-0000-000000000002#12345678`),
      Buffer.alloc(87), Buffer.from([1, 1, 0, 0, 0]),
      compressed ? Buffer.concat([Buffer.from([1]), deflateSync(payload)]) : payload
    ]);
  }
  const child = structure(1,
    '<Member ParentId="51"><Member ID="56" Name="Comandos" RID="0x92020000" SubPartIndex="2" StdO="80" /><Offsets /></Member>');
  const grandchild = structure(2,
    '<Member ParentId="51:56"><Member ID="51" Name="Iniciar" RID="0x02000001" StdO="3" /><Offsets /></Member>', true);
  const wrongChild = structure(2,
    '<Member ParentId="99:56"><Member ID="51" Name="Incorreto" RID="0x02000001" /><Offsets /></Member>', true);
  const padding = Buffer.alloc(256 * 1024 - 15);
  const tags = await importTiaDatabase(Readable.from([
    padding, prefixed.subarray(0, 15), prefixed.subarray(15), unrelated, marker, child, grandchild
  ]));
  assert.deepEqual(tags.map(({ block, name, type }) => [block, name, type]), [
    [block, 'Nível', 'Real'], [block, 'Bits', 'Array[0..127] of Bool'],
    [block, 'Estrutura', 'Estrutura'],
    [block, 'Estrutura.Comandos', 'Estrutura'],
    [block, 'Estrutura.Comandos.Iniciar', 'Bool']
  ]);
  assert.equal(tags[1].last, 127);
  const leaf = tags.find(tag => tag.name.endsWith('.Iniciar'));
  assert.equal(leaf.dbNumber, 41);
  assert.equal(leaf.offsetBits, 179);
  const conflict = Buffer.from(marker);
  conflict[0] = conflict[20] = 42;
  const ambiguousDb = await importTiaDatabase(Readable.from([prefixed, marker, conflict, child, grandchild]));
  assert.ok(ambiguousDb.every(tag => tag.dbNumber === undefined));
  const withoutInvalid = await importTiaDatabase(Readable.from([prefixed, marker, child, wrongChild]));
  assert.ok(!withoutInvalid.some(tag => tag.name.endsWith('.Incorreto')));
  await assert.rejects(importTiaDatabase(Readable.from([prefixed, unrelated])), /Nenhuma declaração/);
});

test('expande UDT com CRC confirmado e identifica tipos escalares de um DB', async () => {
  function rootRecord(name, guid, body, compressed = false) {
    const xml = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(
      `<Root InterfaceGuid="${guid}">${body}</Root>`
    )]);
    return Buffer.concat([
      Buffer.from(`BIVE:${name}/1/${guid}`), Buffer.alloc(87), Buffer.from([1, 1, 0, 0, 0]),
      compressed ? Buffer.concat([Buffer.from([1]), deflateSync(xml)]) : xml
    ]);
  }
  const definition = rootRecord('UDT_Controle', '00000000-0000-0000-0000-000000000003',
    '<Member ID="51" Name="Tempo" RID="0x02000007" StdO="16" /><Offsets CRC="0x1234" />', true);
  const db = rootRecord('Dados', '00000000-0000-0000-0000-000000000004',
    '<Externals><ExternalType Name="UDT_Controle" SubPartIndex="1" OffsetCRC="0x1234">' +
    '<Usage Path="51" /></ExternalType><ExternalType Name="UDT_Controle" SubPartIndex="2" OffsetCRC="0xFFFF">' +
    '<Usage Path="52" /></ExternalType></Externals>' +
    '<Member ID="51" Name="Controle" Type="&quot;UDT_Controle&quot;" SubPartIndex="1" StdO="32" />' +
    '<Member ID="52" Name="Incompatível" Type="&quot;UDT_Controle&quot;" SubPartIndex="2" StdO="64" />' +
    '<Member ID="53" Name="Carimbo" RID="0x0200000E" StdO="96" /><Offsets />');
  const marker = Buffer.from([1, 1, 1, 3, 0x44, 0x42, 6, ...Buffer.from('Dados! ')]);
  const duplicate = rootRecord('UDT_Controle', '00000000-0000-0000-0000-000000000005',
    '<Member ID="51" Name="Tempo" RID="0x02000007" StdO="16" /><Offsets CRC="0x1234" />');
  const rows = await importTiaDatabase(Readable.from([definition, duplicate, db, marker]));
  assert.deepEqual(rows.map(x => [x.name, x.type, x.offsetBits]), [
    ['Controle', '"UDT_Controle"', 32], ['Controle.Tempo', 'DInt', 48],
    ['Incompatível', '"UDT_Controle"', 64], ['Carimbo', 'Date_And_Time', 96]
  ]);
  const conflicting = rootRecord('UDT_Controle', '00000000-0000-0000-0000-000000000006',
    '<Member ID="51" Name="Tempo" RID="0x02000007" StdO="32" /><Offsets CRC="0x1234" />');
  const unresolved = await importTiaDatabase(Readable.from([definition, conflicting, db, marker]));
  assert.ok(!unresolved.some(row => row.name === 'Controle.Tempo'));
});

test('tipos estendidos têm endereço, largura e decodificação coerentes', () => {
  const cases = [
    ['DB5,SINT0', 'DB5,BYTE0', 'ff', -1],
    ['DB5,LREAL0', 'DB5,BYTE0.8', '400c000000000000', 3.5],
    ['DB5,LINT0', 'DB5,BYTE0.8', '8000000000000000', '-9223372036854775808'],
    ['DB5,ULINT0', 'DB5,BYTE0.8', 'ffffffffffffffff', '18446744073709551615'],
    ['DB5,LWORD0', 'DB5,BYTE0.8', 'ffffffffffffffff', '18446744073709551615'],
    ['DB5,WCHAR0', 'DB5,BYTE0.2', '00e7', 'ç'],
    ['DB5,CHAR0', 'DB5,BYTE0', 'e7', 'ç'],
    ['DB5,STRING0.2', 'DB5,BYTE0.4', '0202e761', 'ça'],
    ['DB5,WSTRING0.2', 'DB5,BYTE0.8', '0002000200e70061', 'ça'],
    ['DB5,DATE0', 'DB5,BYTE0.2', '0001', '1990-01-02'],
    ['DB5,TIME0', 'DB5,BYTE0.4', 'fffffc18', -1000],
    ['DB5,TOD0', 'DB5,BYTE0.4', '00000001', '00:00:00.001000000'],
    ['DB5,LTIME0', 'DB5,BYTE0.8', 'ffffffffffffffff', '-1'],
    ['DB5,LTOD0', 'DB5,BYTE0.8', '0000000000000001', '00:00:00.000000001'],
    ['DB5,LDT0', 'DB5,BYTE0.8', '0000000000000001', '1970-01-01T00:00:00.000000001'],
    ['DB5,DTL0', 'DB5,BYTE0.12', '07ea02030501020300000001', '2026-02-03T01:02:03.000000001'],
    ['DB5,S5TIME0', 'DB5,BYTE0.2', '1123', 12300]
  ];
  for (const [address, driverAddress, hex, expected] of cases) {
    const type = extendedAddress(address);
    const bytes = [...Buffer.from(hex, 'hex')];
    assert.equal(type.driverAddress, driverAddress);
    assert.equal(decodeExtended(type, bytes.length === 1 ? bytes[0] : bytes), expected);
  }
  assert.equal(decodeExtended(extendedAddress('DB5,WSTRING0.2'), [0, 2, 0, 3, 0, 0, 0, 0]), null);
  assert.throws(() => extendedAddress('DB5,WSTRING0'), /inválido/);
  assert.equal(extendedAddress('DB5,INT0'), null);
  assert.equal(dbType('VARIANT'), null);
});

test('reúne páginas zlib de DBs e exclui FCs do catálogo', async () => {
  const guid = '00000000-0000-0000-0000-000000000013';
  const root = `<Root InterfaceGuid="${guid}"><Member Name="Primeiro" Type="Int" />` +
    ' '.repeat(4100) + '<Member Name="Segundo" RID="0x02000004" /><Member Name="Texto" Type="String[100]" /></Root>';
  const xml = Buffer.alloc(8192);
  Buffer.from('\ufeff' + root).copy(xml);
  const header = Buffer.alloc(96);
  header.set([0x10, 2, 0, 0, 0, 2, 3], 82);
  function compress(page) {
    const packed = deflateSync(page, { level: 0 });
    return Buffer.concat([Buffer.from([(packed.length & 127) | 128, packed.length >> 7]), packed]);
  }
  const marker = (kind, name) => Buffer.concat([
    Buffer.from([1, 1, 1, 3]), Buffer.from(kind), Buffer.from([Buffer.byteLength(name) + 1]),
    Buffer.from(name + '! ')
  ]);
  const db = Buffer.concat([
    Buffer.from(`BIVE:Dados/${guid}`), header,
    compress(xml.subarray(0, 4096)), compress(xml.subarray(4096)), marker('DB', 'Dados')
  ]);
  const fc = Buffer.from(`<Root InterfaceGuid="${guid}"><Member Name="Entrada" Type="Int" /></Root>BIVE:Rotina/${guid}`);
  const tags = await importTiaDatabase(Readable.from([db, fc, marker('FC', 'Rotina')]));
  assert.deepEqual(tags.map(tag => [tag.block, tag.name]), [['Dados', 'Primeiro'], ['Dados', 'Segundo'], ['Dados', 'Texto']]);
  assert.deepEqual(tags.map(tag => tag.type), ['Int', 'Word', 'String[100]']);
  const incomplete = await importTiaDatabase(Readable.from([db.subarray(0, -500), marker('DB', 'Dados')]));
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0].block, 'Dados');
  assert.equal(incomplete[0].unresolved, true);
});

test('remonta interface referenciada e sugere offsets de UDT quando o CRC diverge', async () => {
  const guid = '00000000-0000-0000-0000-000000000021';
  const udtGuid = '00000000-0000-0000-0000-000000000022';
  const relation = Buffer.from([0x13, 0, 7, 0]);
  const ids = [Buffer.from([1, 2, 3, 4, 0, 0, 0, 0]), Buffer.from([2, 2, 3, 4, 0, 0, 0, 0])];
  const rootHeader = Buffer.alloc(99);
  rootHeader.set([0x10, 0x40, 0, 0, 0, 3], 81);
  const marker = (kind, name) => Buffer.concat([
    Buffer.from([1, 1, 1, kind.length + 1]), Buffer.from(kind),
    Buffer.from([Buffer.byteLength(name) + 1]), Buffer.from(name + '! ')
  ]);
  const linked = Buffer.concat([
    Buffer.from(`BIVE:DB_Test/1/${guid}`), rootHeader,
    relation, ids[0], relation, ids[1]
  ]);
  const xml = Buffer.alloc(8192);
  Buffer.from(
    `\ufeff<Root InterfaceGuid="${guid}"><Externals><ExternalType Name="UDT_Test" SubPartIndex="1" OffsetCRC="0x4567"><Usage Path="51" /></ExternalType></Externals>` +
    ' '.repeat(4200) +
    '<Member ID="51" Name="Instancia" Type="&quot;UDT_Test&quot;" SubPartIndex="1" StdO="32" /><Offsets /></Root>'
  ).copy(xml);
  function part(index) {
    const header = Buffer.alloc(64);
    ids[index].copy(header);
    header[12] = 3;
    header.set([0x10, 1, 0, 0, 0, 1], 54);
    const packed = deflateSync(xml.subarray(index * 4096, (index + 1) * 4096), { level: 0 });
    return Buffer.concat([relation, header, Buffer.from([(packed.length & 127) | 128, packed.length >> 7]), packed]);
  }
  const udtHeader = Buffer.alloc(92);
  udtHeader.set([1, 1, 0, 0, 0], 87);
  const definition = Buffer.concat([
    marker('UDT', 'UDT_Test'),
    Buffer.from(`BIVE:UDT_Test/1/${udtGuid}`), udtHeader,
    Buffer.from(`\ufeff<Root InterfaceGuid="${udtGuid}"><Member ID="51" Name="Ativo" Type="Bool" StdO="2" /><Member ID="52" Name="Contagem" Type="Int" StdO="16" /><Member ID="53" Name="SemOffset" Type="Bool" /><Offsets CRC="0x1234" /></Root>`)
  ]);
  const dbMarker = marker('DB', 'DB_Test');
  const rows = await importTiaDatabase(Readable.from([linked, part(0), part(1), definition, dbMarker]));
  assert.deepEqual(rows.map(row => [row.block, row.name, row.type, row.offsetBits]), [
    ['DB_Test', 'Instancia', '"UDT_Test"', 32],
    ['DB_Test', 'Instancia.Ativo', 'Bool', undefined],
    ['DB_Test', 'Instancia.Contagem', 'Int', undefined],
    ['DB_Test', 'Instancia.SemOffset', 'Bool', undefined]
  ]);
  assert.ok(rows.slice(1).every(row => row.unverifiedLayout));
  assert.deepEqual(rows.map(row => row.suggestedOffsetBits), [undefined, 34, 48, undefined]);
  const missing = await importTiaDatabase(Readable.from([linked, part(0), definition, dbMarker]));
  assert.equal(missing[0].unresolved, true);
});

test('resolve UDT embutida pelos dois CRCs e lê subparte sem versão do DB', async () => {
  const guid = '00000000-0000-0000-0000-000000000041';
  const header = Buffer.concat([Buffer.alloc(87), Buffer.from([1, 1, 0, 0, 0])]);
  const record = (name, xml) => Buffer.concat([Buffer.from(name), header, Buffer.from('\ufeff' + xml)]);
  const db = record(`BIVE:Dados/${guid}`,
    `<Root InterfaceGuid="${guid}"><Externals><ExternalType Name="Tipo" BlockClass="UDT" CRC="0x1234" OffsetCRC="0xABCD" SubPartIndex="1"><Usage Path="51" /></ExternalType></Externals>` +
    '<Member ID="51" Name="Instancia" Type="&quot;Tipo&quot;" SubPartIndex="1" StdO="32" />' +
    '<Member ID="52" Name="Grupo" RID="0x92020000" SubPartIndex="2" StdO="64" /><Offsets /></Root>');
  const structure = record(`BI:Struct2:Dados/${guid}#12345678`,
    '<Member ParentId="52"><Member ID="51" Name="Sinal" Type="Bool" StdO="3" /><Offsets /></Member>');
  const metadata = Buffer.alloc(64);
  metadata.writeUInt32LE(0x1234, 0);
  metadata.writeUInt32LE(20, 4);
  metadata.writeUInt32LE(0xabcd, 32);
  metadata.writeUInt32LE(32, 36);
  metadata.set([1, 0x8b, 8], 50);
  const snapshot = Buffer.concat([
    Buffer.from([0x10, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1]),
    deflateSync(Buffer.from(`\ufeff<Root InterfaceGuid="${guid}"><Member ID="51" Name="Peso" Type="Real" StdO="0" /><Offsets CRC="0xABCD" stdSize="32" /></Root>`))
  ]);
  const marker = Buffer.from([1, 1, 1, 3, 0x44, 0x42, 6, ...Buffer.from('Dados! ')]);
  const read = async () => importTiaDatabase(Readable.from([db, structure, metadata, snapshot, marker]));
  const rows = await read();
  assert.deepEqual(rows.map(({ name, offsetBits }) => [name, offsetBits]),
    [['Instancia', 32], ['Instancia.Peso', 32], ['Grupo', 64], ['Grupo.Sinal', 67]]);
  metadata.writeUInt32LE(0x5678, 0);
  assert.ok(!(await read()).some(row => row.name === 'Instancia.Peso'));
});

test('expande índices de UDT_SegmentoEQP usando tamanho e CRC da definição', async () => {
  const guid = '00000000-0000-0000-0000-000000000050';
  const record = (name, body) => Buffer.concat([Buffer.from(`BIVE:${name}/${guid}`),
    Buffer.alloc(87), Buffer.from([1, 1, 0, 0, 0]),
    Buffer.from(`\ufeff<Root InterfaceGuid="${guid}">${body}</Root>`)]);
  const udt = record('UDT_SegmentoEQP',
    '<Member Name="numEqp" Type="Int" StdO="0" />' +
    '<Member ID="53" Name="cmdEqp" RID="0x91010000" StdO="48" SubPartIndex="0" />' +
    '<Member ID="54" Name="stsEqp" RID="0x91020000" StdO="64" SubPartIndex="1" />' +
    '<Offsets CRC="0xA123" stdSize="80" />');
  const subpart = (owner, index, parent, field) => Buffer.concat([
    Buffer.from(`BI:Struct${index}:UDT_SegmentoEQP/1/${owner}#12345678`),
    Buffer.alloc(87), Buffer.from([1, 1, 0, 0, 0]),
    Buffer.from(`\ufeff<Member ParentId="${parent}"><Member Name="${field}" Type="Bool" StdO="1" /><Offsets stdSize="8" /></Member>`)
  ]);
  const parts = owner => [subpart(owner, 0, 53, 'Comando'), subpart(owner, 1, 54, 'LigadoAuto')];
  const group = parts('00000000-0000-0000-0000-000000000051');
  const db = crc => record('Segmento',
    `<Externals><ExternalType Name="UDT_SegmentoEQP" BlockClass="UDT" OffsetCRC="${crc}" SubPartIndex="2"><Usage Path="61" /></ExternalType></Externals>` +
    '<Member ID="61" Name="EqpSeg" Type="Array[0..2] of &quot;UDT_SegmentoEQP&quot;" StdO="128" SubPartIndex="2" /><Offsets />');
  const marker = Buffer.from([1, 1, 1, 3, 0x44, 0x42, 9, ...Buffer.from('Segmento! ')]);
  const read = (crc, extra = []) => importTiaDatabase(Readable.from([udt, db(crc), ...group, ...extra, marker]));
  const rows = await read('0xA123');
  assert.deepEqual(rows.filter(row => row.name.endsWith('.numEqp')).map(row => row.offsetBits), [128, 208, 288]);
  const status = rows.find(row => row.name === 'EqpSeg[1].stsEqp.LigadoAuto');
  assert.equal(status.suggestedOffsetBits, 273);
  assert.equal(status.offsetBits, undefined);
  const conflicting = await read('0xA123', parts('00000000-0000-0000-0000-000000000052'));
  assert.ok(!conflicting.some(row => row.name.endsWith('.LigadoAuto')));
  assert.ok(!(await read('0xB123')).some(row => row.name.endsWith('.numEqp')));
});

test('importa DB numerado com nome depois do marcador de bloco', async () => {
  const nome = 'DB_Separado';
  const numero = Buffer.from([0x76, 0x05]);
  const prefixo = Buffer.concat([
    numero, Buffer.alloc(8), Buffer.alloc(10, 0xff), numero,
    Buffer.from([0x0e, 0x8a, 0x01]), Buffer.from('Block_DB')
  ]);
  const marcador = Buffer.concat([
    Buffer.from([1, 1, 1, 3]), Buffer.from('DB'),
    Buffer.from([0x21, 0x20, 0, 0, 0, 0x10, 0, 0, 0]),
    Buffer.alloc(4, 0xff), Buffer.alloc(20),
    Buffer.from([nome.length + 1]), Buffer.from(nome),
    Buffer.from([0x22, 0, 0, 0, 0x32, 0, 0, 0])
  ]);
  const guid = '00000000-0000-0000-0000-000000000051';
  const interfaceDb = Buffer.concat([
    Buffer.from(`BIVE:${nome}/${guid}`),
    Buffer.alloc(87), Buffer.from([1, 1, 0, 0, 0]),
    Buffer.from(`\ufeff<Root InterfaceGuid="${guid}"><Member Name="Sinal" Type="Bool" StdO="15" /><Offsets /></Root>`)
  ]);
  const rows = await importTiaDatabase(Readable.from([prefixo, marcador, interfaceDb]));
  assert.deepEqual(rows.map(({ block, name, dbNumber, offsetBits }) => [block, name, dbNumber, offsetBits]),
    [[nome, 'Sinal', 1398, 15]]);
  await assert.rejects(importTiaDatabase(Readable.from([marcador, interfaceDb])), /Nenhuma declaração/);
});
