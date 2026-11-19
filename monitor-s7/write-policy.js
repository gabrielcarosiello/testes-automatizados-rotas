// Shared by browser and server: a checked permission never bypasses address,
// range or value validation. I/Q/M writes are single S7 writes, not force jobs.
export const writeTypes = {
  X: { bytes: 1, accepts: value => typeof value === 'boolean' },
  BYTE: { bytes: 1, min: 0, max: 255, accepts: value => Number.isInteger(value) && value >= 0 && value <= 255 },
  WORD: { bytes: 2, min: 0, max: 65535, accepts: value => Number.isInteger(value) && value >= 0 && value <= 65535 },
  INT: { bytes: 2, min: -32768, max: 32767, accepts: value => Number.isInteger(value) && value >= -32768 && value <= 32767 },
  DWORD: { bytes: 4, min: 0, max: 4294967295, accepts: value => Number.isInteger(value) && value >= 0 && value <= 4294967295 },
  DINT: { bytes: 4, min: -2147483648, max: 2147483647, accepts: value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 },
  REAL: { bytes: 4, accepts: value => typeof value === 'number' && Number.isFinite(Math.fround(value)) }
};
const ioCodes = { '': 'X', B: 'BYTE', W: 'WORD', I: 'INT', DW: 'DWORD', D: 'DWORD', DI: 'DINT', R: 'REAL' };
export function writableType(address) {
  if (typeof address !== 'string') return null;
  const db = /^DB([1-9]\d{0,4}),(BYTE|WORD|DWORD|DINT|INT|REAL|X)(\d{1,7})(?:\.([0-7]))?$/i.exec(address);
  const io = /^([IQMEA])(DI|DW|B|W|I|D|R)?(\d{1,7})(?:\.([0-7]))?$/i.exec(address);
  if (!db && !io) return null;
  if (db && Number(db[1]) > 65535) return null;
  const type = db ? db[2].toUpperCase() : ioCodes[(io[2] || '').toUpperCase()];
  const offset = Number((db || io)[3]), bit = (db || io)[4];
  return offset + writeTypes[type].bytes <= 0x200000 && (type === 'X') === (bit !== undefined) ? type : null;
}
export function writeArea(address) {
  if (/^DB/i.test(address)) return 'DB';
  const first = address?.[0]?.toUpperCase();
  return ({ E: 'I', A: 'Q' })[first] || first;
}
