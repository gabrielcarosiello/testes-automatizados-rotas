import { writableType, writeTypes, writeArea } from './write-policy.js';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import nodes7 from '@st-one-io/nodes7';
import { extendedAddress, decodeExtended } from './db-types.js';
import { CatalogStore } from './catalog-store.mjs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const catalogStore = new CatalogStore(process.env.MONITOR_S7_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Nexxus', 'MonitorS7', 'catalogos'));


const { S7Endpoint, S7ItemGroup, S7Item } = nodes7;
const s7Port = Number(process.env.MONITOR_S7_PORT ?? 102);
if (!Number.isInteger(s7Port) || s7Port < 1 || s7Port > 65535) throw new Error('MONITOR_S7_PORT inválida.');
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const origin = `http://127.0.0.1:${port}`;
const { version } = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8"));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/panel.js', ['panel.js', 'text/javascript; charset=utf-8']],
  ['/tag-selection.js', ['tag-selection.js', 'text/javascript; charset=utf-8']],
  ['/db-types.js', ['db-types.js', 'text/javascript; charset=utf-8']],
  ['/tia-panel.js', ['tia-panel.js', 'text/javascript; charset=utf-8']],
  ['/catalog-filter.js', ['catalog-filter.js', 'text/javascript; charset=utf-8']],
  ['/write-policy.js', ['write-policy.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
].map(([route, [name, type]]) => {
  const bytes = readFileSync(new URL(name, import.meta.url));
  return [route, [route === '/' ? bytes.toString('utf8').replace('{{version}}', version) : bytes, type]];
}));

const demo = { mode: 'demo', tags: [] };
let active = demo;
let sequence = 0;

function publish(session, values) {
  for (const tag of session.tags) {
    const type = extendedAddress(tag.address ?? '');
    if (type) values[tag.id] = decodeExtended(type, values[tag.id]);
  }
  session.sample = { values, sequence: ++sequence, receivedAt: new Date().toISOString() };
  session.diagnostic = null;
}
function snapshot() {
  const { mode, diagnostic, sample, pollMs, tags, host } = active;
  const fresh = sample && Date.now() - Date.parse(sample.receivedAt) <= Math.max(3000, 3 * pollMs);
  const ready = fresh && !diagnostic;
  const connected = mode === 's7' && active.endpoint.isConnected;
  const withoutTags = mode === 'demo' || (connected && tags.length === 0);
  return {
    mode, host, connection: active.id ? `${active.id}:${active.connectionVersion}` : null, state: ready || withoutTags ? 'ok' : 'indisponivel',
    connected,
    diagnostic: ready || withoutTags ? null : diagnostic ?? 'Leitura expirada ou aguardando primeira amostra',
    sequence: ready ? sample.sequence : null,
    receivedAt: ready ? sample.receivedAt : null,
    tags: tags.map(tag => ({
      ...tag, good: Boolean(ready && sample.values[tag.id] !== null), value: ready ? sample.values[tag.id] : null
    }))
  };
}

function validate(config) {
  const { host, rack, slot, pollMs, tags = [] } = config ?? {};
  if (typeof host !== 'string' || isIP(host) !== 4) throw new Error('Informe o IPv4 do CLP.');
  for (const [name, value, min, max] of [
    ['Rack', rack, 0, 7], ['Slot', slot, 0, 31], ['Ciclo', pollMs, 100, 10000]
  ]) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${name} deve ser um inteiro entre ${min} e ${max}.`);
    }
  }
  return { host, rack, slot, pollMs, ...validateTags(tags) };
}

function validateTags(tags) {
  if (!Array.isArray(tags) || tags.length > 32) {
    throw new Error('Selecione até 32 tags.');
  }
  const ids = new Set();
  const normalized = [];
  const items = tags.map(tag => {
    if (typeof tag?.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(tag.id) ||
        tag.id === 'constructor' || ids.has(tag.id) ||
        typeof tag.label !== 'string' || !tag.label.trim() || tag.label.length > 100 ||
        typeof tag.address !== 'string' || !tag.address.trim() || tag.address.length > 64) {
      throw new Error('Cada tag precisa de alias único, nome e endereço S7.');
    }
    ids.add(tag.id);
    const writeType = tag.writable === true ? writableType(tag.address) : null;
    if (tag.writable === true && !writeType) {
      throw new Error(`Escrita indisponível para ${tag.id}. Use um endereço escalar de DB ou I/Q/M compatível.`);
    }
    normalized.push({ id: tag.id, label: tag.label, address: tag.address, writeType });
    try {
      return new S7Item(tag.id, extendedAddress(tag.address)?.driverAddress ?? tag.address);
    } catch {
      throw new Error(`Endereço S7 inválido para ${tag.id} (${tag.address}).`);
    }
  });
  return { tags: normalized, items };
}

function connect(config) {
  const { host, rack, slot, pollMs, tags, items } = validate(config);
  const endpoint = new S7Endpoint({ host, rack, slot, port: s7Port, autoReconnect: 3000 });
  const group = new S7ItemGroup(endpoint);
  group.addItems(items);

  const session = {
    mode: 's7', id: randomUUID(), host, tags, pollMs, diagnostic: 'Conectando ao CLP',
    endpoint, group, timer: null, reading: false, connectionVersion: 0
  };
  const previous = active;
  active = session;
  stop(previous);

  const unavailable = message => {
    session.connectionVersion += 1;
    session.sample = null;
    session.diagnostic = message;
  };
  endpoint.on('error', error => unavailable(error.message || 'Falha de comunicação S7'));
  endpoint.on('disconnect', () => unavailable(session.diagnostic || 'CLP desconectado. Reconectando…'));

  async function read() {
    if (active !== session || !session.tags.length || session.reading || session.writing || session.reconfiguring || !endpoint.isConnected) return;
    session.reading = true;
    const connectionVersion = session.connectionVersion;
    const currentGroup = session.group;
    try {
      session.pendingRead = currentGroup.readAllItems();
      const values = await session.pendingRead;
      if (active === session && endpoint.isConnected && connectionVersion === session.connectionVersion) {
        publish(session, values);
      }
    } catch (error) {
      unavailable(error.message);
    } finally {
      session.reading = false;
      session.pendingRead = null;
      if (active === session) {
        if (!session.writing && !session.reconfiguring) session.timer = setTimeout(read, pollMs);
      } else {
        currentGroup.destroy();
      }
    }
  }
  session.read = read;
  endpoint.on('connect', () => {
    session.diagnostic = null;
    clearTimeout(session.timer);
    void read();
  });
}

async function applyMapping(config) {
  const session = active;
  if (!session.endpoint) throw new Error('Conecte a CPU antes de aplicar as tags.');
  const { tags, items } = validateTags(config?.tags);
  session.reconfiguring = true;
  clearTimeout(session.timer);
  try {
    await session.pendingRead?.catch(() => {});
    const group = new S7ItemGroup(session.endpoint);
    group.addItems(items);
    session.group.destroy();
    session.group = group;
    session.tags = tags;
    session.sample = null;
    if (session.endpoint.isConnected) session.diagnostic = null;
    session.connectionVersion += 1;
  } finally {
    session.reconfiguring = false;
    void session.read();
  }
}

async function writeTag({ id, connection, value, expected } = {}) {
  const session = active;
  const tag = session.tags.find(item => item.id === id);
  if (!tag?.writeType) throw new Error('A tag não está habilitada para escrita.');
  if (!writeTypes[tag.writeType].accepts(value)) throw new Error('Valor incompatível com o tipo da tag.');
  if (session.reconfiguring) throw new Error('Aguarde a aplicação das tags antes de escrever.');
  if (session.writing) throw new Error('Já existe uma escrita em andamento.');

  function verifyTarget() {
    const current = snapshot();
    if (current.connection !== connection || current.state !== 'ok' || !session.endpoint.isConnected) {
      throw new Error('A conexão mudou ou está indisponível. Confira a tag e tente novamente.');
    }
    const reading = current.tags.find(item => item.id === id);
    if (!reading?.good || !writeTypes[tag.writeType].accepts(reading.value)) throw new Error('Leitura atual da tag inválida. Aguarde uma leitura válida antes de escrever.');
    if (session.sample.values[id] !== expected) {
      throw new Error('O valor atual mudou. Abra a escrita novamente para conferi-lo.');
    }
  }

  verifyTarget();
  session.writing = true;
  clearTimeout(session.timer);
  try {
    await session.pendingRead?.catch(() => {});
    verifyTarget();
    try {
      await session.group.writeItems(id, value);
    } catch (error) {
      throw new Error(`Escrita sem confirmação. Consulte a leitura antes de reenviar. ${error.message}`);
    }
    try {
      const values = await session.group.readAllItems();
      if (snapshot().connection === connection && session.endpoint.isConnected) {
        publish(session, values);
        const observed = values[id];
        const written = tag.writeType === 'REAL' ? Math.fround(value) : value;
        return { acknowledged: true, verified: observed === written, observed, address: tag.address, area: writeArea(tag.address), writeMode: 's7-single', sequence: session.sample.sequence, receivedAt: session.sample.receivedAt };
      }
    } catch {
      session.sample = null;
    }
    return { acknowledged: true, verified: false, observed: null, address: tag.address, area: writeArea(tag.address), writeMode: 's7-single' };
  } finally {
    session.writing = false;
    void session.read();
  }
}

function stop(session) {
  if (!session.endpoint) return;
  clearTimeout(session.timer);
  void session.endpoint.disconnect().catch(() => {});
  if (!session.reading) session.group.destroy();
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
}

async function readDiagnosticDbs(config) {
  if (!Array.isArray(config?.tags) || !config.tags.length ||
      config.tags.some(tag => tag?.writable === true || !/^DB[1-9]\d*,(?:X\d+\.[0-7]|(?:BYTE|SINT|WORD|INT|DWORD|DINT)\d+)$/i.test(tag?.address ?? ''))) {
    throw new Error('Diagnóstico aceita somente leituras escalares de DB.');
  }
  const { host, rack, slot, tags, items } = validate({ ...config, pollMs: 1000 });
  const endpoint = new S7Endpoint({ host, rack, slot, port: s7Port, autoReconnect: 0 });
  endpoint.on('error', () => {});
  const group = new S7ItemGroup(endpoint);
  try {
    group.addItems(items);
    await endpoint.connect();
    const values = await group.readAllItems();
    return { host, tags: tags.map(({ id, address }) => {
      const type = extendedAddress(address);
      const value = type ? decodeExtended(type, values[id]) : values[id];
      return { id, address, good: value != null, value: value ?? null };
    }) };
  } finally {
    group.destroy();
    void endpoint.disconnect().catch(() => {});
  }
}

async function readBody(request, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size <= limit) chunks.push(chunk);
  }
  if (size > limit) throw new Error('O arquivo ou a configuração excede o tamanho permitido.');
  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  const route = request.url?.split('?')[0];
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const host = request.headers.host?.toLowerCase();
  if (!hosts.has(host)) {
    response.writeHead(403).end();
    return;
  }
  if (request.method === 'POST' && route === '/api/tia/importar') {
    if (request.headers.origin !== `http://${host}` || request.headers['content-type'] !== 'application/octet-stream') {
      response.writeHead(403).end();
      return;
    }
    try {
      const name = decodeURIComponent(request.headers['x-tia-project'] || 'Projeto TIA');
      json(response, 200, await catalogStore.import(request, name));
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }
  if (request.method === 'GET' && ['/api/tia/catalogos', '/api/tia/catalogo'].includes(route)) {
    try { json(response, 200, route.endsWith('catalogos') ? { catalogos: await catalogStore.list() } : await catalogStore.current()); }
    catch (error) { json(response, 500, { error: error.message }); }
    return;
  }
  if (request.method === 'POST' && ['/api/tia/selecionar', '/api/tia/remover'].includes(route)) {
    if (request.headers.origin !== `http://${host}` || request.headers['content-type'] !== 'application/json') { response.writeHead(403).end(); return; }
    try {
      const { id, confirmar } = JSON.parse((await readBody(request, 1024)).toString('utf8'));
      if (route.endsWith('remover') && confirmar !== true) throw new Error('Confirme a remoção do catálogo.');
      json(response, 200, await (route.endsWith('remover') ? catalogStore.remove(id) : catalogStore.select(id)));
    } catch (error) { json(response, 400, { error: error.message }); }
    return;
  }
  if (request.method === 'POST' && ['/api/conexao', '/api/mapeamento', '/api/simulacao', '/api/escrita', '/api/diagnostico-dbs'].includes(route)) {
    if (request.headers.origin !== `http://${host}` || request.headers['content-type'] !== 'application/json') {
      response.writeHead(403).end();
      return;
    }
    try {
      if (route === '/api/diagnostico-dbs') {
        const config = JSON.parse((await readBody(request, 16384)).toString('utf8'));
        json(response, 200, await readDiagnosticDbs(config));
        return;
      }
      if (route === '/api/escrita') {
        const config = JSON.parse((await readBody(request, 2048)).toString('utf8'));
        json(response, 200, await writeTag(config));
        return;
      }
      const config = route !== '/api/simulacao'
        ? JSON.parse((await readBody(request, 16384)).toString('utf8')) : null;
      if (active.reconfiguring) throw new Error('Aguarde a aplicação das tags.');
      if (active.writing) throw new Error('Aguarde a conclusão da escrita antes de alterar a conexão.');
      if (route === '/api/conexao') {
        connect(config);
      } else if (route === '/api/mapeamento') {
        await applyMapping(config);
      } else {
        const previous = active;
        active = demo;
        stop(previous);
      }
      json(response, 200, snapshot());
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }
  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  const segment = /^\/api\/segmentos\/([1-9]\d{0,4})$/.exec(route ?? '');
  if (segment) {
    const { tags, ...metadata } = snapshot();
    const db = Number(segment[1]);
    const prefix = `seg${db}_`;
    const id = tags.find(tag => tag.id === prefix + 'id');
    const total = tags.find(tag => tag.id === prefix + 'total');
    const slots = tags.flatMap(tag => {
      const index = tag.id.startsWith(prefix) && /^eqp_(\d+)$/.exec(tag.id.slice(prefix.length));
      return index ? [{ index: Number(index[1]), tag }] : [];
    }).sort((a, b) => a.index - b.index);
    if (!id || !total || !slots.length) {
      json(response, 404, { error: 'Mapeie e aplique as tags da lista de equipamentos deste DB.' });
      return;
    }
    const valid = metadata.mode === 's7' && metadata.connected && metadata.state === 'ok' &&
      [id, total, ...slots.map(slot => slot.tag)].every(tag => tag.good && Number.isInteger(tag.value));
    const positions = slots.map(({ index, tag }) => ({ index, numEqp: valid ? tag.value : null }));
    json(response, valid ? 200 : 503, { ...metadata, db, idSegmento: valid ? id.value : null,
      totalEqpSegmento: valid ? total.value : null, posicoes: positions });
    return;
  }
  if (route === '/api/tags' || route?.startsWith('/api/tags/')) {
    const data = snapshot();
    if (route === '/api/tags') {
      json(response, data.state === 'ok' ? 200 : 503, data);
      return;
    }
    const { tags, ...metadata } = data;
    const tag = tags.find(item => route === '/api/tags/' + item.id);
    if (!tag) {
      json(response, 404, { error: 'Tag não cadastrada' });
      return;
    }
    json(response, data.state === 'ok' ? 200 : 503, { ...metadata, tag });
    return;
  }
  const asset = assets.get(route);
  if (!asset) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': asset[1] }).end(asset[0]);
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${port} já está em uso. Defina outra no PowerShell com $env:PORT = '3001' e execute npm.cmd start novamente.`);
  } else {
    console.error(`Falha ao iniciar o monitor: ${error.message}`);
  }
  // The simulation timer is still active even when listen fails.
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => console.log(`Monitor S7 v${version} em ${origin}`));
