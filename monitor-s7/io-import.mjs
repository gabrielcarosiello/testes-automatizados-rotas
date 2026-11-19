// PLC tag records observed in PEData V16. Only length-delimited typed records
// are accepted; never infer an I/O address from a DB number or a digital ID.
const formats = new Map([
  ['BOOL', ['', '', 1]], ['BYTE', ['B', 'B', 1]], ['USINT', ['B', 'B', 1]],
  ['CHAR', ['B', 'C', 1]], ['WORD', ['W', 'W', 2]], ['UINT', ['W', 'W', 2]],
  ['INT', ['W', 'I', 2]], ['DWORD', ['D', 'D', 4]], ['UDINT', ['D', 'D', 4]],
  ['DINT', ['D', 'DI', 4]], ['REAL', ['D', 'R', 4]]
]);
export function ioAddress(operand, type) {
  const match = /^%([IQMEA])([BWD]?)(\d+)(?:\.([0-7]))?$/i.exec(operand);
  const format = formats.get(type.toUpperCase());
  if (!match || !format) return null;
  let [, area, width, byte, bit] = match;
  area = ({ E: 'I', A: 'Q' })[area.toUpperCase()] ?? area.toUpperCase();
  if (width.toUpperCase() !== format[0] || (type.toUpperCase() === 'BOOL') !== (bit !== undefined) ||
      Number(byte) + format[2] > 0x200000) return null;
  return { area, address: `${area}${format[1]}${Number(byte)}${bit === undefined ? '' : '.' + bit}` };
}

export function scanIoTags(raw, register) {
  const family = /([\x06\x07])S7(?:1200|1500|300|400)([\x02-\x30])/g;
  for (const match of raw.matchAll(family)) {
    const familyBytes = match[0].length - 2;
    if (match[1].charCodeAt(0) !== familyBytes + 1) continue;
    const start = match.index + match[0].length;
    const length = match[2].charCodeAt(0) - 1;
    const operand = raw.slice(start, start + length);
    const rest = raw.slice(start + length, start + length + 384);
    if (!rest.startsWith('c\x00\x00\x00\x38\x00\x00\x00\x39\x00\x00\x00')) continue;
    // Do not cross the next PLC tag record, even if this one is truncated.
    const next = rest.search(/[\x06\x07]S7(?:1200|1500|300|400)/);
    const body = next < 0 ? rest : rest.slice(0, next);
    const typed = /\x01([\x02-\x20])([A-Za-z_]+)%\x00\x0c\x00/.exec(body);
    if (!typed || typed[1].charCodeAt(0) !== typed[2].length + 1) continue;
    const candidates = [];
    const tail = body.slice(typed.index + typed[0].length);
    for (const nameMatch of tail.matchAll(/\x1e\x00\x00\x00([\x02-\x80])/g)) {
      const size = nameMatch[1].charCodeAt(0) - 1;
      const nameBytes = tail.slice(nameMatch.index + 5, nameMatch.index + 5 + size);
      if (nameBytes.length !== size) continue;
      const name = Buffer.from(nameBytes, 'latin1').toString('utf8');
      if (/^[\p{L}_][\p{L}\p{N}_. -]*$/u.test(name) && !name.includes('\uFFFD')) candidates.push(name);
    }
    if (candidates.length !== 1) continue;
    const decoded = ioAddress(operand, typed[2]);
    if (!decoded) continue;
    const block = { I: 'Entradas (I)', Q: 'Saídas (Q)', M: 'Memórias (M)' }[decoded.area];
    register({ block, name: candidates[0], type: typed[2], ...decoded, tiaAddress: operand,
      source: 'plc-tag-plf', io: true });
  }
}
