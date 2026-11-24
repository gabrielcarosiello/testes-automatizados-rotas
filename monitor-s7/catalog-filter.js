export const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const entryArea = entry => entry.area || 'DB';
export function searchable(entry) {
  return normalized(`${entry.block} ${entry.name} ${entry.type} ${entry.address || ''} ${entry.tiaAddress || ''} ${entry.dbNumber ? 'DB' + entry.dbNumber : ''}`);
}
export function matchesEntry(entry, filters, text = searchable(entry)) {
  return (!filters.area || entryArea(entry) === filters.area) &&
    (!filters.block || entry.block === filters.block) &&
    (!filters.type || filters.classify(entry) === filters.type) &&
    (filters.tokens || normalized(filters.query).split(/\s+/).filter(Boolean)).every(token => text.includes(token));
}
