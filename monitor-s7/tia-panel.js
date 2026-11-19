import { matchesEntry, searchable, entryArea, normalized } from './catalog-filter.js';
import { dbType } from './db-types.js';

const byId = id => document.getElementById(id);
const folderInput = byId('tia-folder');
const openFolder = byId('tia-open-folder');
const status = byId('tia-status');
const selection = byId('tia-select');
const array = byId('tia-array');
const blockFilter = byId('tia-block');
const typeFilter = byId('tia-type-filter');
const enter = byId('tia-enter');
const up = byId('tia-up');
const segment = byId('tia-segment');
const levels = [];
const db = byId('tia-db');
const offset = byId('tia-offset');
const first = byId('tia-first');
const last = byId('tia-last');
const mapping = byId('mapping');
const stride = byId('tia-stride');
const lengthInput = byId('tia-length');
const add = byId('tia-add');
const all = byId('tia-all');
let entries = [];
let searchTexts = [];
let currentCatalog = null;
let resultLimit = 200;
let operation = 0;
const query = byId('tia-query');
const areaFilter = byId('tia-area');
const catalogSelect = byId('tia-catalog');


function unknownString(entry) {
  return /^(W?STRING) \(comprimento não identificado\)$/i.exec(entry.elementType ?? entry.type)?.[1];
}

function tagType(entry, length = 1) {
  const text = unknownString(entry);
  return entry.nestedInArray ? null : dbType(text ? `${text}[${length}]` : entry.elementType ?? entry.type);
}

function filterType(entry) {
  const type = (entry.elementType ?? entry.type).split(/[[(]/, 1)[0].trim().toUpperCase();
  if (/^TIPO INTERNO 0X9/.test(type)) return 'ESTRUTURA SEM DEFINIÇÃO';
  if (type.startsWith('TIPO INTERNO ')) return 'TIPOS INTERNOS';
  if (/^"[^"]+"$/.test(type)) return 'UDT';
  return type === 'STRUCT' ? 'ESTRUTURA' : type;
}

function selectBounds() {
  const selected = entries[Number(array.value)];
  first.value = selected.first ?? 0;
  last.value = selected.last ?? 0;
  first.min = last.min = first.value;
  first.max = last.max = last.value;
}

function toggleInput(id, input, enabled) {
  byId(id).hidden = !enabled;
  input.disabled = !enabled;
  input.required = enabled;
}

function memberPath(parent, entry) {
  if (entry.block !== parent.block) return '';
  if (entry.name.startsWith(parent.name + '.')) return entry.name.slice(parent.name.length + 1);
  if (parent.elementType === '"UDT_SegmentoEQP"' && entry.name.startsWith(parent.name + '[')) {
    return entry.name.slice(parent.name.length);
  }
  return '';
}

function segmentMapping(selected) {
  if (selected.elementType !== '"UDT_SegmentoEQP"' || !selected.dbNumber || selected.nestedInArray ||
      selected.first < 0 || selected.last - selected.first + 3 > 32) return [];
  const blockEntries = new Map(entries.filter(entry => entry.block === selected.block).map(entry => [entry.name, entry]));
  const paths = [['id', 'ID_Segmento'], ['total', 'TotalEqpSegmento']];
  for (let index = selected.first; index <= selected.last; index++) {
    paths.push([`eqp_${index}`, `${selected.name}[${index}].numEqp`]);
  }
  const lines = [];
  for (const [key, path] of paths) {
    const entry = blockEntries.get(path);
    if (!entry || entry.dbNumber !== selected.dbNumber || entry.type.toUpperCase() !== 'INT' ||
        !Number.isInteger(entry.offsetBits) || entry.offsetBits % 8) return [];
    lines.push(`seg${selected.dbNumber}_${key} | ${selected.block}.${path} | DB${selected.dbNumber},INT${entry.offsetBits / 8}`);
  }
  return lines;
}

function showSelection() {
  const selected = entries[Number(array.value)];
  if (array.selectedIndex < 0 || !selected) {
    byId('tia-type').textContent = 'Nenhuma variável corresponde aos filtros.';
    byId('tia-addressing').hidden = true;
    add.disabled = true;
    all.hidden = enter.hidden = segment.hidden = true;
    up.hidden = levels.length === 0;
    byId('tia-navigation').hidden = up.hidden;
    return;
  }
  const type = tagType(selected);
  const indexed = selected.first !== undefined;
  const usable = selected.io ? Boolean(selected.address) : Boolean(type);
  const hasChildren = !selected.io && entries.some(entry => memberPath(selected, entry));
  const canMapSegment = segmentMapping(selected).length > 0;
  segment.hidden = !canMapSegment;
  enter.hidden = !hasChildren;
  up.hidden = levels.length === 0;
  byId('tia-navigation').hidden = enter.hidden && up.hidden && segment.hidden;
  byId('tia-type').textContent = selected.unresolved
    ? `DB identificado${selected.dbNumber ? ' (' + selected.dbNumber + ')' : ''}. Interface indisponível; use o cadastro manual.`
    : selected.unverifiedLayout ? `${selected.type} · ${Number.isInteger(selected.suggestedOffsetBits) ? 'Offset sugerido pela definição da UDT.' : 'Campo da definição da UDT.'} Layout sugerido, sem confirmação no arquivo.`
    : selected.io ? `${selected.type} · ${selected.tiaAddress} → ${selected.address} · Escrita disponível por permissão na revisão de tags.`
    : usable ? selected.type
    : hasChildren ? `${selected.type} · Abra a estrutura para escolher um campo.`
    : /^Tipo interno 0x9/i.test(selected.type) ? `${selected.type} · Estrutura sem definição resolvida.`
    : `${selected.type} · Sem mapeamento direto nesta versão.`;
  byId('tia-addressing').hidden = !usable || selected.io === true;
  add.disabled = !usable;
  db.disabled = offset.disabled = !usable || selected.io === true;
  all.hidden = !usable || !indexed;
  const unknownLength = unknownString(selected);
  toggleInput('tia-length-label', lengthInput, usable && Boolean(unknownLength));
  lengthInput.value = '';
  lengthInput.max = unknownLength?.toUpperCase() === 'WSTRING' ? 16382 : 254;
  toggleInput('tia-first-label', first, usable && indexed);
  toggleInput('tia-last-label', last, usable && indexed);
  toggleInput('tia-stride-label', stride, usable && indexed && type.code !== 'X');
  db.value = selected.dbNumber ?? '';
  const bits = selected.offsetBits ?? selected.suggestedOffsetBits;
  offset.value = Number.isInteger(bits) && type
    ? type.code === 'X' ? `${Math.floor(bits / 8)}.${bits % 8}` : bits % 8 === 0 ? String(bits / 8) : ''
    : '';
  offset.placeholder = type?.code === 'X' ? 'Ex.: 0.0' : 'Ex.: 4';
  stride.min = type?.width ?? 1;
  stride.value = '';
  selectBounds();
}

function projectDatabase(files) {
  const paths = new Map();
  const projects = [];
  for (const file of files) {
    const path = file.webkitRelativePath.toLowerCase();
    paths.set(path, file);
    if (/^[^/]+\/[^/]+\.ap16$/.test(path)) projects.push(path);
  }
  const root = projects[0]?.split('/')[0];
  const database = paths.get(`${root}/system/pedata.plf`);
  if (projects.length !== 1 || !database) {
    throw new Error('Selecione a pasta principal que contém o .ap16 e System/PEData.plf.');
  }
  return database;
}

async function loadProject() {
  const token = ++operation;
  selection.hidden = true;
  openFolder.disabled = true;
  status.textContent = 'Lendo o projeto…';
  try {
    const response = await fetch('/api/tia/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-TIA-Project': encodeURIComponent(folderInput.files[0]?.webkitRelativePath.split('/')[0] || 'Projeto TIA') },
      body: projectDatabase(folderInput.files)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (token !== operation) return;
    applyCatalog(result);
    await refreshCatalogs();
  } catch (error) {
    if (token === operation) { status.textContent = error.message; selection.hidden = !entries.length; }
  } finally {
    openFolder.disabled = false;
  }
}

function applyCatalog(result) {
  entries = result.arrays || [];
  currentCatalog = result.catalogo;
  searchTexts = entries.map(searchable);
  levels.length = 0;
  query.value = areaFilter.value = blockFilter.value = typeFilter.value = '';
  resultLimit = 200;
  showEntries();
  selection.hidden = !entries.length;
  const blocks = new Set(entries.filter(e => !e.io).map(e => e.block));
  const pending = entries.filter(e => e.unresolved).length;
  const ioCount = entries.filter(e => e.io).length;
  status.textContent = entries.length ? `${blocks.size} DBs · ${entries.length - pending - ioCount} declarações · ${ioCount} pontos de I/O${pending ? ' · ' + pending + ' DBs sem interface importada' : ''}. ${result.catalogo ? (result.cached ? 'Catálogo reutilizado.' : 'Catálogo salvo neste computador.') : ''}` : 'Nenhum catálogo ativo. Selecione uma pasta de projeto.';
}

function filters(overrides = {}) {
  return { area: areaFilter.value, block: blockFilter.value, type: typeFilter.value, query: query.value, tokens: normalized(query.value).split(/\s+/).filter(Boolean), classify: filterType, ...overrides };
}
function updateFacets() {
  const oldBlock = blockFilter.value, oldType = typeFilter.value;
  const blocks = new Map(), types = new Map();
  const byBlock = filters({ block: '' }), byType = filters({ type: '' });
  entries.forEach((entry, index) => {
    if (matchesEntry(entry, byBlock, searchTexts[index])) blocks.set(entry.block, (blocks.get(entry.block) || 0) + 1);
    if (matchesEntry(entry, byType, searchTexts[index]) && !entry.unresolved) {
      const type = filterType(entry); types.set(type, (types.get(type) || 0) + 1);
    }
  });
  // Keep a selected facet even when another filter leaves zero matches.
  // This avoids silently changing the user's search.
  if (oldBlock && !blocks.has(oldBlock)) blocks.set(oldBlock, 0);
  if (oldType && !types.has(oldType)) types.set(oldType, 0);
  blockFilter.replaceChildren(new Option('Todos os DBs / grupos', ''), ...[...blocks].sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true })).map(([name, count]) => new Option(`${name} (${count})`, name)));
  typeFilter.replaceChildren(new Option('Todos os tipos', ''), ...[...types].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => new Option(`${name} (${count})`, name)));
  blockFilter.value = oldBlock; typeFilter.value = oldType;
}
function showEntries() {
  updateFacets();
  const parent = levels.at(-1);
  const options = document.createDocumentFragment();
  let firstSupported, total = 0;
  const currentFilters = filters();
  entries.forEach((entry, index) => {
    if (!matchesEntry(entry, currentFilters, searchTexts[index])) return;
    const name = parent ? memberPath(parent, entry) : `${entry.block} / ${entry.name}`;
    if (!name || (parent?.elementType === '"UDT_SegmentoEQP"' && !/^\[-?\d+\]$/.test(name))) return;
    total++;
    if (total > resultLimit) return;
    const kind = filterType(entry);
    const label = ['ESTRUTURA SEM DEFINIÇÃO', 'TIPOS INTERNOS'].includes(kind) ? kind : entry.type;
    options.append(new Option(`${name} · ${label}${entry.io ? ' · ' + entry.tiaAddress : ''}`, String(index)));
    if (firstSupported === undefined && (entry.io || tagType(entry))) firstSupported = String(index);
  });
  array.replaceChildren(options);
  if (firstSupported !== undefined) array.value = firstSupported;
  byId('tia-results').textContent = `${array.options.length} de ${total} resultados${parent ? ' nesta estrutura' : ''}`;
  byId('tia-more').hidden = total <= resultLimit;
  showSelection();
}
async function refreshCatalogs() {
  const response = await fetch('/api/tia/catalogos');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  catalogSelect.replaceChildren(new Option('Selecione um catálogo', ''), ...(data.catalogos || []).map(c => new Option(`${c.name} · ${new Date(c.createdAt).toLocaleString('pt-BR')} · ${c.id.slice(-8)}`, c.id)));
  catalogSelect.value = currentCatalog?.id || '';
}
async function savedAction(action) {
  const id = catalogSelect.value;
  if (!id) { status.textContent = 'Selecione um catálogo salvo.'; return; }
  if (action === 'remover' && !window.confirm('Remover esta versão e seu PEData salvo deste computador?')) return;
  const token = ++operation;
  try {
    const response = await fetch('/api/tia/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, confirmar: true }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (token !== operation) return;
    if (action === 'selecionar') applyCatalog(result);
    else if (currentCatalog?.id === id) applyCatalog({ arrays: [], catalogo: null });
    await refreshCatalogs();
  } catch (error) { status.textContent = error.message; }
}
byId('tia-load-catalog').addEventListener('click', () => savedAction('selecionar'));
byId('tia-remove-catalog').addEventListener('click', () => savedAction('remover'));
let queryTimer;
query.addEventListener('input', () => { clearTimeout(queryTimer); queryTimer = setTimeout(() => { levels.length = 0; resultLimit = 200; showEntries(); }, 160); });
areaFilter.addEventListener('change', () => { levels.length = 0; resultLimit = 200; showEntries(); });
byId('tia-clear-filters').addEventListener('click', () => {
  clearTimeout(queryTimer); query.value = areaFilter.value = blockFilter.value = typeFilter.value = ''; levels.length = 0; resultLimit = 200; showEntries();
});
byId('tia-more').addEventListener('click', () => { resultLimit += 200; showEntries(); });
async function restoreCatalog() {
  const token = operation;
  try {
    const response = await fetch('/api/tia/catalogo');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (token !== operation) return;
    if (result.arrays?.length) applyCatalog({ ...result, cached: true });
    await refreshCatalogs();
  } catch (error) {
    if (token === operation) {
      status.textContent = 'Não foi possível restaurar o catálogo: ' + error.message;
      try { await refreshCatalogs(); } catch {}
    }
  }
}
void restoreCatalog();

blockFilter.addEventListener('change', () => {
  levels.length = 0;
  showEntries();
});
typeFilter.addEventListener('change', () => {
  levels.length = 0;
  showEntries();
});
enter.addEventListener('click', () => {
  typeFilter.value = query.value = '';
  resultLimit = 200;
  levels.push(entries[Number(array.value)]);
  showEntries();
});
up.addEventListener('click', () => {
  const previous = levels.pop();
  showEntries();
  array.value = String(entries.indexOf(previous));
  showSelection();
});

openFolder.addEventListener('click', loadProject);

array.addEventListener('change', showSelection);
all.addEventListener('click', selectBounds);
segment.addEventListener('click', () => {
  const selected = entries[Number(array.value)];
  const additions = segmentMapping(selected);
  const lines = mapping.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const aliases = new Map(lines.map(line => [line.split('|')[0].trim(), line]));
  const pending = additions.filter(line => !aliases.has(line.split('|')[0].trim()));
  if (additions.some(line => {
    const previous = aliases.get(line.split('|')[0].trim());
    return previous && previous !== line;
  }) || lines.length + pending.length > 256) {
    status.textContent = 'Revise os aliases existentes e o limite de 256 tags no mapeamento.';
    return;
  }
  mapping.value = [...lines, ...pending].join('\n');
  mapping.dispatchEvent(new Event('input'));
  status.textContent = `Segmento DB${selected.dbNumber} mapeado. Selecione suas tags e clique em Aplicar tags.`;
});
lengthInput.addEventListener('input', () => {
  const type = tagType(entries[Number(array.value)], lengthInput.value);
  if (type) stride.min = type.width;
});
selection.addEventListener('submit', event => {
  event.preventDefault();
  const selected = entries[Number(array.value)];
  if (!selected) return;
  if (selected.io) {
    const alias = `io_${selected.address.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const lines = mapping.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length >= 256 || lines.some(line => line.split('|')[0].trim() === alias)) { status.textContent = 'Endereço já mapeado ou limite de 256 entradas atingido.'; return; }
    const label = selected.name.replace(/[|\r\n]/g, ' ').slice(0, 100);
    mapping.value = [...lines, `${alias} | ${label} | ${selected.address}`].join('\n');
    mapping.dispatchEvent(new Event('input'));
    status.textContent = 'Ponto de I/O adicionado. Na revisão de tags, marque Permitir escrita se necessário e clique em Aplicar tags.';
    return;
  }
  const type = tagType(selected, lengthInput.value);
  if (!type) return;
  const indexed = selected.first !== undefined;
  const start = indexed ? first.valueAsNumber : 0;
  const end = indexed ? last.valueAsNumber : 0;
  const bitType = type.code === 'X';
  const step = bitType ? 1 : indexed ? stride.valueAsNumber * 8 : 0;
  const offsetPattern = bitType ? /^\d{1,7}\.[0-7]$/ : /^\d{1,7}$/;
  if (!offsetPattern.test(offset.value)) {
    status.textContent = bitType ? 'Informe o offset no formato byte.bit.' : 'Informe o offset em bytes, sem casas decimais.';
    return;
  }
  const [byte, bit = 0] = offset.value.split('.').map(Number);
  const base = byte * 8 + bit;
  const lines = mapping.value.trim().split(/\r?\n/).filter(line => line.trim());
  if (end < start || end - start + 1 + lines.length > 256) {
    status.textContent = 'Revise o intervalo. O catálogo admite até 256 entradas. Selecione até 32 para a conexão.';
    return;
  }
  const displacement = indexed ? selected.first : 0;
  const finalBit = base + (end - displacement) * step + (bitType ? 0 : type.width * 8 - 1);
  if (!Number.isSafeInteger(finalBit) || finalBit > 0xffffff) {
    status.textContent = 'O offset excede a faixa de endereçamento S7.';
    return;
  }
  const aliases = new Set(lines.map(line => line.split('|')[0].trim()));
  const added = [];
  for (let index = start; index <= end; index++) {
    const position = base + (index - displacement) * step;
    const addressByte = Math.floor(position / 8);
    const suffix = bitType ? `.${position % 8}` : type.length ? `.${type.length}` : '';
    const alias = `db${db.value}_${addressByte}${bitType ? '_' + position % 8 : ''}`;
    if (aliases.has(alias)) {
      status.textContent = `O alias ${alias} já consta no mapeamento.`;
      return;
    }
    const indexLabel = indexed ? `[${index}]` : '';
    const label = `${selected.block}.${selected.name}${indexLabel}`.replace(/[|\r\n]/g, ' ').slice(-100);
    const address = `DB${db.value},${type.code}${addressByte}${suffix}`;
    added.push(`${alias} | ${label} | ${address}`);
  }
  mapping.value = [...lines, ...added].join('\n');
  mapping.dispatchEvent(new Event('input'));
  status.textContent = `${added.length} tag(s) adicionada(s). Revise o mapeamento e clique em Aplicar tags.`;
});
