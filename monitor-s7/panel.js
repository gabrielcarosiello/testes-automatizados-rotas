import { writeTypes } from './write-policy.js';
import { normalized } from './catalog-filter.js';
import { selectedTags } from './tag-selection.js';

const fontSize = document.querySelector('#font-size');
const fontStorageKey = 'monitor-s7-font-size';
try {
  const savedSize = localStorage.getItem(fontStorageKey);
  if ([...fontSize.options].some(option => option.value === savedSize)) fontSize.value = savedSize;
} catch {
  // The control still works when browser storage is unavailable.
}
function applyFontSize() {
  document.documentElement.style.fontSize = `${fontSize.value}px`;
}
fontSize.addEventListener('change', () => {
  applyFontSize();
  try { localStorage.setItem(fontStorageKey, fontSize.value); } catch {}
});
applyFontSize();

const filter = document.querySelector('#filter');
const table = document.querySelector('#tags');
const cards = document.querySelector('#tag-cards');
const tableView = document.querySelector('#tag-table');
const cardsButton = document.querySelector('#view-cards');
const tableButton = document.querySelector('#view-table');
const state = document.querySelector('#state');
const diagnostic = document.querySelector('#diagnostic');
const form = document.querySelector('#connect');
const formError = document.querySelector('#form-error');
const count = document.querySelector('#tag-count');
const validity = document.querySelector('#tag-validity');
const quality = document.querySelector('#quality');
const qualityFill = document.querySelector('#quality-fill');
const source = document.querySelector('#source');
const lastRead = document.querySelector('#last-read');
const sample = document.querySelector('#sample');
const visibleCount = document.querySelector('#visible-count');
const clockFormat = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });
let snapshot;
let lastTags;
const writeMessages = new Map();
const numericDrafts = new Map();
let pendingWrite = false;

function writeControls(tag) {
  const controls = element('div', 'write-controls', '');
  const boolean = tag.writeType === 'X';
  const button = element('button', 'button secondary write-button', pendingWrite ? 'Aguarde…' : boolean ? tag.value === true ? 'Desaciona' : 'Aciona' : 'Escrever');
  button.type = 'button';
  button.dataset.writeTag = tag.id;
  button.disabled = pendingWrite || !tag.good || (boolean && typeof tag.value !== 'boolean');
  const message = writeMessages.get(tag.id);
  if (message?.connection === snapshot.connection) controls.append(element('small', 'write-feedback', message.text));
  let input;
  if (!boolean) {
    input = element('input', 'write-number-inline', '');
    input.type = 'number'; input.step = tag.writeType === 'REAL' ? 'any' : '1'; input.placeholder = 'Novo valor';
    input.setAttribute('aria-label', `Novo valor: ${tag.label}`);
    input.dataset.writeInput = tag.id;
    const range = writeTypes[tag.writeType];
    if (range.min !== undefined) { input.min = String(range.min); input.max = String(range.max); }
    input.value = numericDrafts.get(tag.id) || '';
    input.disabled = pendingWrite || !tag.good;
    input.addEventListener('input', () => numericDrafts.set(tag.id, input.value));
    controls.prepend(input);
  }
  controls.append(button);
  button.addEventListener('click', async () => {
    if (pendingWrite) return;
    const current = snapshot?.tags.find(item => item.id === tag.id && item.address === tag.address);
    if (!current?.good || !current.writeType || current.writeType !== tag.writeType) return;
    const connection = snapshot.connection;
    const value = boolean ? !current.value : input.valueAsNumber;
    if (!writeTypes[current.writeType].accepts(value)) {
      writeMessages.set(tag.id, { connection, text: 'Informe um valor válido para o tipo da tag.' }); draw(); return;
    }
    pendingWrite = true;
    writeMessages.set(tag.id, { connection, text: 'Enviando…' });
    draw();
    try {
      const response = await fetch('/api/escrita', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: current.id, connection, expected: current.value, value }),
        signal: AbortSignal.timeout(10000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      writeMessages.set(tag.id, { connection, text: result.verified
        ? `Releitura: ${result.observed === true ? '1' : result.observed === false ? '0' : result.observed}.`
        : `Escrita respondida; valor não confirmado (${result.observed ?? 'sem leitura'}).` });
      // Reflect only an acknowledged read-back from the same still-active mapping.
      // An older poll already in flight must not overwrite this sample.
      if (snapshot.connection === connection && result.verified && current.address === result.address &&
          Number.isInteger(result.sequence) && result.sequence >= (snapshot.sequence ?? -1)) {
        snapshot = { ...snapshot, sequence: result.sequence, receivedAt: result.receivedAt,
          tags: snapshot.tags.map(item => item.id === current.id ? { ...item, value: result.observed, good: true } : item) };
      }
    } catch (error) {
      writeMessages.set(tag.id, { connection, text: `${error.message}. Confira a leitura antes de reenviar.` });
    } finally {
      pendingWrite = false;
      updateSummary();
      draw();
    }
  });
  return controls;
}

function element(type, className, text) {
  const item = document.createElement(type);
  item.className = className;
  item.textContent = text;
  return item;
}

function valueBadge(tag) {
  const label = !tag.good ? '—' : tag.value === true ? 'Verdadeiro'
    : tag.value === false ? 'Falso' : typeof tag.value === 'string' ? tag.value : JSON.stringify(tag.value);
  const badge = element('span', 'value mono', label ?? '—');
  badge.dataset.value = !tag.good ? 'invalid' : tag.value === true ? 'on'
    : tag.value === false ? 'off' : 'other';
  return badge;
}

function readBadge(tag) {
  const badge = element('span', 'status', tag.good ? 'Válida' : 'Indisponível');
  badge.dataset.state = tag.good ? 'ok' : 'indisponivel';
  return badge;
}

function renderCard(tag) {
  const card = element('article', 'tag-card', '');
  const head = element('div', 'tag-card-head', '');
  const name = element('div', 'tag-name', tag.label);
  name.append(element('small', 'tag-alias mono', tag.id));
  head.append(name, readBadge(tag));
  const value = element('div', 'tag-value', '');
  value.append(valueBadge(tag));
  card.append(head, value, element('small', 'mono', tag.address ?? 'Simulação'));
  if (tag.writeType) card.append(writeControls(tag));
  return card;
}

function renderRow(tag) {
  const row = document.createElement('tr');
  const name = row.insertCell();
  name.append(element('strong', 'tag-name', tag.label), element('small', 'tag-alias mono', tag.id));
  row.insertCell().append(element('span', 'mono', tag.address ?? '—'));
  row.insertCell().append(valueBadge(tag));
  const reading = row.insertCell();
  reading.append(readBadge(tag));
  if (tag.writeType) reading.append(writeControls(tag));
  return row;
}

function draw() {
  const all = snapshot?.tags ?? [];
  const words = normalized(filter.value).split(/\s+/).filter(Boolean);
  const area = document.querySelector('#monitor-area').value;
  const quality = document.querySelector('#monitor-quality').value;
  const visible = all.filter(tag => {
    const tagArea = /^DB/i.test(tag.address || '') ? 'DB' : ({ E: 'I', A: 'Q' })[(tag.address || '')[0]] || (tag.address || '')[0];
    const text = normalized(`${tag.id} ${tag.label} ${tag.address || ''}`);
    return (!area || tagArea === area) && (!quality || (tag.good ? 'good' : 'bad') === quality) && words.every(word => text.includes(word));
  });
  visibleCount.textContent = `${visible.length} de ${all.length} tags`;
  const rows = document.createDocumentFragment();
  const useTable = !tableView.hidden;
  for (const tag of visible) {
    const item = useTable ? renderRow(tag) : renderCard(tag);
    item.dataset.tag = tag.id;
    rows.append(item);
  }
  if (!visible.length) {
    const message = all.length ? 'Nenhuma tag corresponde à busca.' : 'Sem tags disponíveis.';
    if (useTable) {
      const row = document.createElement('tr');
      const cell = row.insertCell();
      cell.className = 'empty';
      cell.colSpan = 4;
      cell.textContent = message;
      rows.append(row);
    } else {
      rows.append(element('p', 'empty', message));
    }
  }
  const focused = document.activeElement?.dataset.writeInput;
  (useTable ? table : cards).replaceChildren(rows);
  if (focused) [...document.querySelectorAll('[data-write-input]')].find(input => input.dataset.writeInput === focused)?.focus();
}

function setView(useTable) {
  tableView.hidden = !useTable;
  cards.hidden = useTable;
  cardsButton.setAttribute('aria-pressed', String(!useTable));
  tableButton.setAttribute('aria-pressed', String(useTable));
  (useTable ? cards : table).replaceChildren();
  draw();
}

function updateSummary() {
  const total = snapshot.tags.length;
  const valid = snapshot.tags.filter(tag => tag.good).length;
  const percentage = total ? Math.round(100 * valid / total) : 0;
  let status = snapshot.state === 'ok' ? 'Leitura ativa' : 'Indisponível';
  if (snapshot.mode === 'demo') status = 'Sem tags';
  if (snapshot.connected && !total) status = 'Conectado · sem tags';
  if (snapshot.connected && total && snapshot.state !== 'ok') status = 'Conectado · leitura indisponível';
  state.dataset.state = snapshot.connected ? 'ok' : snapshot.state;
  if (state.textContent !== status) state.textContent = status;
  diagnostic.textContent = snapshot.diagnostic ?? '';
  diagnostic.hidden = !snapshot.diagnostic;
  source.textContent = snapshot.mode === 'demo'
    ? 'Simulação · sem conexão com o CLP'
    : snapshot.mode === 's7' ? `CLP ${snapshot.host}:102` : 'Fonte indisponível';
  count.textContent = total;
  validity.textContent = `${valid} válidas · ${total - valid} indisponíveis`;
  quality.textContent = total ? `${percentage}%` : '—';
  qualityFill.style.width = `${percentage}%`;
  lastRead.textContent = snapshot.receivedAt ? clockFormat.format(new Date(snapshot.receivedAt)) : '—';
  sample.textContent = snapshot.receivedAt ? `Amostra ${snapshot.sequence}` : 'Sem amostra válida';
}

async function refresh() {
  try {
    const response = await fetch('/api/tags', { signal: AbortSignal.timeout(2500) });
    const next = await response.json();
    const older = snapshot?.connection === next.connection && Number.isInteger(snapshot?.sequence) && Number.isInteger(next.sequence) && next.sequence < snapshot.sequence;
    if (!older) {
      if (snapshot?.connection !== next.connection) { writeMessages.clear(); numericDrafts.clear(); }
      snapshot = next;
    }
  } catch {
    snapshot = {
      state: 'indisponivel', diagnostic: 'Sem resposta da API',
      tags: (snapshot?.tags ?? []).map(tag => ({ ...tag, value: null, good: false }))
    };
  }
  updateSummary();
  const signature = JSON.stringify([snapshot.connection, snapshot.tags]);
  if (signature !== lastTags) {
    lastTags = signature;
    draw();
  }
  setTimeout(refresh, 250);
}

async function submit(route, config) {
  formError.textContent = '';
  const buttons = [...form.querySelectorAll('button'), document.querySelector('#apply-tags')];
  buttons.forEach(button => { button.disabled = true; });
  try {
    const response = await fetch(route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      signal: AbortSignal.timeout(4000)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Falha ao aplicar configuração.');
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  void submit('/api/conexao', {
    host: data.get('host').trim(), rack: Number(data.get('rack')),
    slot: Number(data.get('slot')), pollMs: Number(data.get('pollMs'))
  });
});
document.querySelector('#apply-tags').addEventListener('click', () => {
  void submit('/api/mapeamento', { tags: selectedTags() });
});
document.querySelector('#demo').addEventListener('click', () => void submit('/api/simulacao', {}));
const connection = document.querySelector('#configurar');
function revealConnection() {
  if (window.location.hash === '#configurar') connection.open = true;
}
for (const link of document.querySelectorAll('.config-link')) {
  link.addEventListener('click', () => { connection.open = true; });
}
window.addEventListener('hashchange', revealConnection);
revealConnection();
cardsButton.addEventListener('click', () => setView(false));
tableButton.addEventListener('click', () => setView(true));
filter.addEventListener('input', draw);
document.querySelector('#monitor-area').addEventListener('change', draw);
document.querySelector('#monitor-quality').addEventListener('change', draw);
refresh();
