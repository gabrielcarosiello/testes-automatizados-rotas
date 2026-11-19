import { writableType } from './write-policy.js';
import { dbType, selectableTypes } from './db-types.js';

const byId = id => document.getElementById(id);
const mapping = byId('mapping');
const list = byId('selection-list');
const count = byId('selection-count');
const options = new Map();

function rows() {
  const lines = mapping.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.map(line => {
    const [id, label, address, extra] = line.split('|').map(part => part.trim());
    return { line, id, label, address: extra === undefined ? address : '' };
  });
}

export function selectedTags() {
  return rows().filter(row => options.get(row.line)?.selected !== false)
    .map(({ line, ...tag }) => ({ ...tag, writable: options.get(line)?.writable === true }));
}

function renderSelection() {
  const tags = rows();
  const current = new Set(tags.map(tag => tag.line));
  for (const line of options.keys()) {
    if (!current.has(line)) options.delete(line);
  }
  const nodes = document.createDocumentFragment();
  for (const tag of tags) {
    const settings = options.get(tag.line) ?? { selected: true, writable: false };
    options.set(tag.line, settings);
    const row = document.createElement('div');
    row.className = 'selection-row';
    const caption = document.createElement('span');
    caption.textContent = tag.address ? `${tag.label} · ${tag.address}` : tag.line;
    function checkbox(labelText, field, disabled = false) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = settings[field];
      input.disabled = disabled;
      if (field === 'writable' && disabled) input.title = settings.selected ? 'Endereço ou tipo não compatível com escrita escalar.' : 'Selecione Monitorar antes de habilitar a escrita.';
      input.addEventListener('change', () => {
        settings[field] = input.checked;
        if (field === 'selected') {
          if (!input.checked) settings.writable = false;
          renderSelection();
          rowFocus();
        }
      });
      function rowFocus() {
        const replacement = [...list.children][tags.indexOf(tag)];
        replacement?.querySelector('input')?.focus();
      }
      input.setAttribute('aria-label', `${labelText}: ${tag.id}`);
      label.append(input, labelText);
      return label;
    }
    const canWrite = Boolean(writableType(tag.address));
    row.append(caption, checkbox('Monitorar', 'selected'),
      checkbox('Permitir escrita', 'writable', !settings.selected || !canWrite));
    nodes.append(row);
  }
  list.replaceChildren(nodes);
  count.textContent = `${selectedTags().length} de ${tags.length} selecionadas · até 32 por conexão`;
}

function selectAll(selected) {
  for (const settings of options.values()) {
    settings.selected = selected;
    if (!selected) settings.writable = false;
  }
  renderSelection();
}

byId('select-all').addEventListener('click', () => selectAll(true));
byId('select-none').addEventListener('click', () => selectAll(false));
mapping.addEventListener('input', renderSelection);
const manualType = byId('manual-type');
const manualLength = byId('manual-length');
manualType.replaceChildren(...selectableTypes.map(type => new Option(type, type)));
manualType.value = 'BOOL';
manualType.addEventListener('change', () => {
  const text = ['STRING', 'WSTRING'].includes(manualType.value);
  byId('manual-length-label').hidden = !text;
  manualLength.disabled = !text;
  manualLength.max = manualType.value === 'WSTRING' ? 16382 : 254;
});

byId('manual-add').addEventListener('click', () => {
  const id = byId('manual-alias').value.trim();
  const label = byId('manual-name').value.trim() || id;
  const db = byId('manual-db').valueAsNumber;
  const offset = byId('manual-offset').value.trim();
  const type = manualType.value;
  const format = dbType(manualLength.disabled ? type : `${type}[${manualLength.value}]`);
  const status = byId('manual-status');
  const offsetPattern = type === 'BOOL' ? /^\d{1,7}\.[0-7]$/ : /^\d{1,7}$/;
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id) || id === 'constructor' ||
      rows().some(tag => tag.id === id) || label.length > 100 || label.includes('|') ||
      !format || !Number.isInteger(db) || db < 1 || db > 65535 || !offsetPattern.test(offset)) {
    status.textContent = 'Informe um alias único, DB válido e offset byte.bit para BOOL ou byte para os demais tipos.';
    return;
  }
  if (Number(offset.split('.')[0]) + format.width > 0x200000) {
    status.textContent = 'O offset excede a faixa de endereçamento S7.';
    return;
  }
  const address = `DB${db},${format.code}${offset}${format.length ? '.' + format.length : ''}`;
  mapping.value = [mapping.value.trim(), `${id} | ${label} | ${address}`].filter(Boolean).join('\n');
  renderSelection();
  status.textContent = `${address} adicionado.`;
});
renderSelection();
