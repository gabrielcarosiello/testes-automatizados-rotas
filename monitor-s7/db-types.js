// Fixed layouts are in bytes. Types decoded by the monitor use the driver's BYTE reads.
const direct = new Map([
  ['BOOL', ['X', 1]], ['BYTE', ['BYTE', 1]], ['USINT', ['BYTE', 1]],
  ['WORD', ['WORD', 2]], ['INT', ['INT', 2]], ['UINT', ['WORD', 2]],
  ['DWORD', ['DWORD', 4]], ['DINT', ['DINT', 4]], ['UDINT', ['DWORD', 4]],
  ['REAL', ['REAL', 4]], ['DT', ['DT', 8]]
]);

const rawWidths = new Map([
  ['SINT', 1], ['LREAL', 8], ['LWORD', 8], ['LINT', 8], ['ULINT', 8],
  ['CHAR', 1], ['WCHAR', 2], ['DTL', 12], ['DATE', 2], ['TIME', 4], ['TOD', 4], ['LTIME', 8],
  ['LTOD', 8], ['LDT', 8], ['S5TIME', 2]
]);

const aliases = new Map([
  ['DATE_AND_TIME', 'DT'], ['DATEANDTIME', 'DT'], ['TIME_OF_DAY', 'TOD'],
  ['TIMEOFDAY', 'TOD'], ['LTIME_OF_DAY', 'LTOD'], ['LTIMEOFDAY', 'LTOD'],
  ['DATE_AND_LTIME', 'LDT']
]);

export const selectableTypes = [...direct.keys(), ...rawWidths.keys(), 'STRING', 'WSTRING'].sort();

export function dbType(declaration) {
  const upper = declaration.trim().toUpperCase();
  const type = aliases.get(upper) ?? upper;
  const text = /^(W?STRING)\s*(?:\[\s*(\d{1,5})\s*\])?$/.exec(type);
  if (text) {
    const code = text[1];
    const length = Number(text[2] ?? 254);
    const wide = code === 'WSTRING';
    if (length < 1 || length > (wide ? 16382 : 254)) return null;
    return { code, length, width: wide ? 4 + 2 * length : 2 + length };
  }
  const item = direct.get(type);
  if (item) return { code: item[0], width: item[1] };
  const width = rawWidths.get(type);
  return width ? { code: type, width } : null;
}

export function extendedAddress(address) {
  const parts = /^DB(\d+),(S5TIME|[A-Z_]+)(\d+)(?:\.(\d+))?$/i.exec(address);
  if (!parts) return null;
  const [, db, raw, offset, length] = parts;
  const code = raw.toUpperCase();
  const text = code === 'STRING' || code === 'WSTRING';
  if (!rawWidths.has(code) && !text) return null;
  // Retain the driver's native STRING array notation (length.count).
  const type = text && length ? dbType(`${code}[${length}]`) : dbType(code);
  if (!type || text !== (length !== undefined) ||
      Number(db) < 1 || Number(db) > 65535 || Number(offset) + type.width > 0x200000) {
    throw new Error('Endereço de tipo estendido inválido.');
  }
  return { ...type, driverAddress: `DB${db},BYTE${offset}${type.width > 1 ? '.' + type.width : ''}` };
}

function timeOfDay(ns) {
  if (ns >= 86400000000000n) return null;
  const seconds = Number(ns / 1000000000n);
  const pad = value => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}.${String(ns % 1000000000n).padStart(9, '0')}`;
}

export function decodeExtended(type, value) {
  const bytes = Buffer.from(Array.isArray(value) ? value : [value]);
  if (bytes.length !== type.width || value === undefined || value === null) return null;
  switch (type.code) {
    case 'SINT': return bytes.readInt8();
    case 'LREAL': {
      const number = bytes.readDoubleBE();
      return Number.isFinite(number) ? number : null;
    }
    case 'LINT':
    case 'LTIME': return bytes.readBigInt64BE().toString();
    case 'LWORD':
    case 'ULINT': return bytes.readBigUInt64BE().toString();
    case 'TIME': return bytes.readInt32BE();
    case 'DATE': return new Date(Date.UTC(1990, 0, 1) + bytes.readUInt16BE() * 86400000).toISOString().slice(0, 10);
    case 'TOD': return timeOfDay(BigInt(bytes.readUInt32BE()) * 1000000n);
    case 'LTOD': return timeOfDay(bytes.readBigUInt64BE());
    case 'LDT': {
      const ns = bytes.readBigUInt64BE();
      if (ns > 0x7fffffffffffffffn) return null;
      const second = new Date(Number(ns / 1000000000n) * 1000).toISOString().slice(0, 19);
      return `${second}.${String(ns % 1000000000n).padStart(9, '0')}`;
    }
    case 'S5TIME': {
      const word = bytes.readUInt16BE();
      const digits = [(word >> 8) & 15, (word >> 4) & 15, word & 15];
      if (digits.some(digit => digit > 9)) return null;
      const base = [10, 100, 1000, 10000][(word >> 12) & 3];
      return (digits[0] * 100 + digits[1] * 10 + digits[2]) * base;
    }
    case 'DTL': {
      const year = bytes.readUInt16BE();
      const [month, day, weekday, hour, minute, second] = bytes.subarray(2, 8);
      const ns = bytes.readUInt32BE(8);
      if (year < 1970 || year > 2262 || weekday < 1 || weekday > 7 || ns > 999999999) return null;
      const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day ||
          date.getUTCHours() !== hour || date.getUTCMinutes() !== minute ||
          date.getUTCSeconds() !== second) return null;
      return `${date.toISOString().slice(0, 19)}.${String(ns).padStart(9, '0')}`;
    }
    case 'CHAR': return String.fromCharCode(bytes.readUInt8());
    case 'STRING': {
      const capacity = bytes.readUInt8();
      const length = bytes.readUInt8(1);
      if (capacity > type.length || length > capacity) return null;
      return bytes.toString('latin1', 2, 2 + length);
    }
    case 'WCHAR': return String.fromCharCode(bytes.readUInt16BE());
    case 'WSTRING': {
      const capacity = bytes.readUInt16BE();
      const length = bytes.readUInt16BE(2);
      if (capacity > type.length || length > capacity) return null;
      return bytes.subarray(4, 4 + 2 * length).swap16().toString('utf16le');
    }
    default: return null;
  }
}
