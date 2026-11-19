import { scanIoTags } from './io-import.mjs';
import { inflateSync } from 'node:zlib';

// A candidate comprises the bounded XML fragment plus its BIVE reference.
const scanWindow = 1024 * 1024;
const scanOverlap = 320 * 1024;
const maxRecordBytes = 300 * 1024;
export async function importTiaDatabase(stream) {
  const ioTags = new Map();
  const ambiguousIo = new Set();
  const dbNames = new Map();
  const codeBlocks = new Set();
  const udtNames = new Set();
  const interfaces = new Map();
  const links = new Map();
  const wanted = new Set();
  const fragments = new Map();
  const ambiguousFragments = new Set();
  const embedded = new Map();
  const ambiguousEmbedded = new Set();
  const parts = new Map();
  const ambiguousParts = new Set();
  const unique = new Map();
  const ambiguous = new Set();
  let pending = '';
  for await (const chunk of stream) {
    pending += chunk.toString('latin1');
    if (pending.length >= scanWindow) {
      scan(pending);
      pending = pending.slice(-scanOverlap);
    }
  }
  scan(pending);
  const linkedKeys = resolveLinkedInterfaces(links, fragments, ambiguousFragments, interfaces);
  const externalTypes = new Map();
  const registeredUdts = new Set(udtNames);
  for (const { block, body } of interfaces.values()) {
    for (const [token] of body.matchAll(/<ExternalType\b[^>]*>/g)) {
      const name = attribute(token, 'Name');
      if (!name || codeBlocks.has(name) || dbNames.has(name)) continue;
      const kind = attribute(token, 'BlockClass');
      if (kind && kind !== 'UDT') continue;
      if (kind === 'UDT' || registeredUdts.has(block)) udtNames.add(name);
      const crc = crcWord(attribute(token, 'CRC'));
      const layout = crcWord(attribute(token, 'OffsetCRC'));
      if (!crc || !layout) continue;
      const key = JSON.stringify([name, layout]);
      const previous = externalTypes.get(key);
      externalTypes.set(key, previous === undefined || previous === crc ? crc : '');
    }
  }
  associateSegmentParts(interfaces, parts, ambiguousParts);
  const ownersWithParts = new Set([...parts.keys()].map(key => key.slice(0, key.lastIndexOf(':'))));
  const definitions = new Map();
  const ambiguousDefinitions = new Set();
  const udtPreviews = new Map();
  const ambiguousPreviews = new Set();
  for (const [key, { block, body }] of interfaces) {
    if (!block || dbNames.has(block)) continue;
    const offsets = /<Offsets\b[^>]*>/.exec(body)?.[0];
    const crc = offsets && attribute(offsets, 'CRC');
    // A versioned reference can duplicate the same complete interface.
    // Keep the owner identity when it is needed to resolve separate subparts.
    const definition = { key: ownersWithParts.has(key) ? key : '', body };
    if (crc) register(definitions, ambiguousDefinitions, JSON.stringify([block, crcWord(crc)]), definition);
    if (udtNames.has(block)) register(udtPreviews, ambiguousPreviews, block, definition);
  }
  for (const [key, crc] of externalTypes) {
    const [name, layout] = JSON.parse(key);
    const embeddedKey = crc + ':' + layout;
    if (!udtNames.has(name) || !crc || definitions.has(key) || ambiguousEmbedded.has(embeddedKey)) continue;
    const body = embedded.get(embeddedKey);
    if (body) definitions.set(key, { key: '', body });
  }
  for (const key of ambiguousDefinitions) definitions.delete(key);
  for (const key of ambiguousPreviews) udtPreviews.delete(key);
  for (const [key, { block, body }] of interfaces) {
    if (dbNames.has(block)) {
      const catalogKey = linkedKeys.has(key) ? JSON.stringify([block, 'linked']) : key;
      readMembers(body, block, catalogKey, unique, ambiguous, parts, ambiguousParts, definitions, [], 0, key, 0, udtPreviews);
    }
  }

  function scan(window) {
    scanIoTags(window, entry => {
      const key = entry.name;
      const previous = ioTags.get(key);
      if (previous && (previous.address !== entry.address || previous.type !== entry.type)) ambiguousIo.add(key);
      else ioTags.set(key, entry);
    });
    // Latin-1 preserves byte positions. Decode the XML and names after delimiting records.
    for (const match of window.matchAll(/\x01\x01\x01(?:\x03(DB|FC|FB|OB)|\x04(UDT))(\x21\x20\x00{3}\x10\x00{3}\xff{4}\x00{20})?([\x02-\x7f])/g)) {
      const delayedName = Boolean(match[3]);
      if (delayedName && match[1] !== 'DB') continue;
      const size = match[4].charCodeAt(0) - 1;
      const start = match.index + match[0].length;
      const end = start + size;
      const terminator = delayedName ? '\x22\x00\x00\x00\x32\x00\x00\x00' : '! ';
      if (window.slice(end, end + terminator.length) !== terminator) continue;
      const name = utf8(window.slice(start, end));
      if (match[2] === 'UDT') {
        udtNames.add(name);
        continue;
      }
      if (match[1] !== 'DB') {
        codeBlocks.add(name);
        continue;
      }
      const numbers = dbNames.get(name) ?? new Set();
      if (!delayedName) dbNames.set(name, numbers);
      // A numbered DB relation has a fixed tag and repeats its number in the record header.
      const header = window.slice(Math.max(0, match.index - 512), match.index);
      const relations = [...header.matchAll(/ÿ{10}([\s\S]{2})\x0e\x01/g)];
      const relation = relations.at(-1);
      if (!relation || !header.slice(relation.index + relation[0].length).includes('Block_DB')) continue;
      const [low, high] = [...relation[1]].map(byte => byte.charCodeAt(0));
      const number = low + high * 256;
      const repeated = header.slice(relation.index - 10, relation.index - 6);
      if (number && repeated === relation[1] + '\x00\x00') {
        numbers.add(number);
        dbNames.set(name, numbers);
      }
    }
    discoverMembers(window, unique, ambiguous, interfaces, links, wanted);
    discoverLinkedFragments(window, wanted, fragments, ambiguousFragments);
    discoverParts(window, parts, ambiguousParts);
    discoverEmbeddedDefinitions(window, embedded, ambiguousEmbedded);
  }
  const arrays = [...unique].filter(([key, item]) => !ambiguous.has(key) &&
    ((!codeBlocks.has(item.block) && !udtNames.has(item.block)) || dbNames.has(item.block))).map(([, array]) => {
    const numbers = dbNames.get(array.block);
    return numbers?.size === 1 ? { ...array, dbNumber: numbers.values().next().value } : array;
  });
  const imported = new Set(arrays.map(item => item.block));
  for (const [block, numbers] of dbNames) {
    if (imported.has(block)) continue;
    arrays.push({ block, name: 'Interface não localizada', type: 'DB sem interface importada',
      unresolved: true, ...(numbers.size === 1 ? { dbNumber: numbers.values().next().value } : {}) });
  }
  arrays.push(...[...ioTags].filter(([name]) => !ambiguousIo.has(name)).map(([, entry]) => entry));
  if (!arrays.length) throw new Error('Nenhuma declaração de DB ou tag de I/O compatível foi localizada no projeto.');
  return arrays;
}

// Scalar RID low words match the Siemens PLCSIM EDataType enumeration.
const scalarTypes = new Map([
  [0, 'Tipo não declarado'], [1, 'Bool'], [2, 'Byte'], [3, 'Char'], [4, 'Word'], [5, 'Int'],
  [6, 'DWord'], [7, 'DInt'], [8, 'Real'], [9, 'Date'], [10, 'Time_Of_Day'], [11, 'Time'],
  [12, 'S5Time'], [14, 'Date_And_Time'], [17, 'Struct'], [19, 'String (comprimento não identificado)'],
  [20, 'Pointer'], [22, 'Any'], [28, 'Counter'], [29, 'Timer'], [30, 'IEC_Counter'], [31, 'IEC_Timer'],
  [36, 'Block_OB'], [37, 'Block_UDT'], [40, 'BBOOL (otimizado)'],
  [48, 'LReal'], [49, 'ULInt'], [50, 'LInt'], [51, 'LWord'], [52, 'USInt'], [53, 'UInt'],
  [54, 'UDInt'], [55, 'SInt'], [61, 'WChar'], [62, 'WString (comprimento não identificado)'],
  [63, 'Variant'], [64, 'LTime'], [65, 'LTime_Of_Day'], [66, 'LDT'], [67, 'DTL'],
  [68, 'IEC_LTimer'], [69, 'IEC_SCounter'], [70, 'IEC_DCounter'], [71, 'IEC_LCounter'],
  [72, 'IEC_UCounter'], [73, 'IEC_USCounter'], [74, 'IEC_UDCounter'], [75, 'IEC_ULCounter'],
  [97, 'ErrorStruct'], [98, 'NREF'], [101, 'CREF'],
  [129, 'EVENT_ANY'], [130, 'EVENT_ATT'], [131, 'EVENT_HWINT'],
  [144, 'HW_ANY'], [145, 'HW_IOSYSTEM'], [146, 'HW_DPMASTER'], [147, 'HW_DEVICE'],
  [148, 'HW_DPSLAVE'], [149, 'HW_IO'], [150, 'HW_MODULE'], [151, 'HW_SUBMODULE'],
  [152, 'HW_HSC'], [153, 'HW_PWM'], [154, 'HW_PTO'], [155, 'HW_INTERFACE'], [156, 'HW_IEPORT'],
  [160, 'OB_ANY'], [161, 'OB_DELAY'], [162, 'OB_TOD'], [163, 'OB_CYCLIC'], [164, 'OB_ATT'],
  [168, 'CONN_ANY'], [169, 'CONN_PRG'], [170, 'CONN_OUC'], [171, 'CONN_R_ID'],
  [173, 'PORT'], [174, 'RTM'], [175, 'PIP'], [192, 'OB_PCYCLE'], [193, 'OB_HWINT'],
  [195, 'OB_DIAG'], [196, 'OB_TIMEERROR'], [197, 'OB_STARTUP'],
  [208, 'DB_ANY'], [209, 'DB_WWW'], [210, 'DB_DYN'], [257, 'DB']
]);

function scalarType(rid) {
  return /^0x0200[\da-f]{4}$/i.test(rid) ? scalarTypes.get(parseInt(rid.slice(6), 16)) : undefined;
}

function utf8(bytes) {
  return Buffer.from(bytes, 'latin1').toString('utf8');
}

const root = String.raw`<Root\b(?=[^>]{0,1024}\bInterfaceGuid="[\da-f-]{36}")[^>]{0,1024}>((?:(?!<Root\b|</Root>)[\s\S]){0,262144})</Root>`;
const rootPayload = new RegExp(String.raw`^\xef\xbb\xbf` + root, 'i');

function discoverMembers(raw, unique, ambiguous, interfaces, links, wanted) {
  const before = /BIVE:([^/\x00-\x1f]{1,100})\/(?:(\d{1,6})\/)?([\da-f-]{36})/gi;
  const after = new RegExp(root + String.raw`[^\x20]{0,24}BIVE:([^/\x00-\x1f]{1,100})/([\da-f-]{36})`, 'gi');
  for (const [, body, block, reference] of raw.matchAll(after)) {
    readMembers(utf8(body), utf8(block), reference, unique, ambiguous);
  }
  for (const match of raw.matchAll(before)) {
    const [, block, version, reference] = match;
    const start = match.index + match[0].length;
    const record = raw.slice(start, start + maxRecordBytes);
    const name = utf8(block);
    const key = partKey(name, version, reference);
    const body = rootPayload.exec(interfacePayload(record))?.[1];
    if (!body) {
      // V16 split interface records have two ordered links to dense page groups.
      const linked = /^\x10\x40\x00\x00\x00\x03[\s\S]{12}\x13\x00\x07\x00([\s\S]{8})\x13\x00\x07\x00([\s\S]{8})/
        .exec(record.slice(81, 123));
      if (linked) {
        const ids = linked.slice(1);
        const previous = links.get(key);
        if (!previous) links.set(key, { block: name, ids });
        else if (previous.ids.join('') !== ids.join('')) links.set(key, { block: name, ids: [] });
        for (const id of ids) wanted.add(id);
      }
      continue;
    }
    const decoded = utf8(body);
    if (!interfaces.has(key)) interfaces.set(key, { block: name, body: decoded });
    else if (interfaces.get(key)?.body !== decoded) interfaces.set(key, { block: '', body: '' });
  }
}

function discoverLinkedFragments(raw, wanted, fragments, ambiguous) {
  if (!wanted.size) return;
  const records = /\x13\x00\x07\x00([\s\S]{8})\x00{4}\x03\x00{7}/g;
  for (const match of raw.matchAll(records)) {
    const id = match[1];
    if (!wanted.has(id)) continue;
    const start = match.index + 4;
    const record = raw.slice(start, start + maxRecordBytes);
    const offset = 54;
    const count = record.charCodeAt(offset + 1);
    if (record.charCodeAt(offset) !== 0x10 || record.slice(offset + 2, offset + 5) !== '\x00\x00\x00' ||
        !(count >= 1 && count <= 32) || record.charCodeAt(offset + 5) !== count) continue;
    const payload = densePages(record, offset + 6 + 4 * count, count);
    if (payload) register(fragments, ambiguous, id, payload);
  }
}

function resolveLinkedInterfaces(links, fragments, ambiguous, interfaces) {
  const linkedKeys = new Set();
  for (const [key, { block, ids }] of links) {
    if (ids.length !== 2 || ids.some(id => ambiguous.has(id) || !fragments.has(id))) continue;
    const payload = ids.map(id => fragments.get(id)).join('');
    const body = rootPayload.exec(payload)?.[1];
    if (!body || interfaces.has(key)) continue;
    interfaces.set(key, { block, body: utf8(body) });
    linkedKeys.add(key);
  }
  return linkedKeys;
}

function interfacePayload(record) {
  // Older headers vary slightly in size. Accept only a matching page-count
  // marker and dense layout, then verify each decompressed page.
  for (let offset = 79; offset <= 84; offset++) {
    const count = record.charCodeAt(offset + 1);
    if (record.charCodeAt(offset) !== 0x10 || record.slice(offset + 2, offset + 5) !== '\x00\x00\x00' ||
        !(count >= 1 && count <= 64) || record.charCodeAt(offset + 5) !== count) continue;
    const start = offset + 6 + 4 * count;
    const payload = count === 1 ? xmlPayload(record.slice(start)) : densePages(record, start, count);
    if (payload.startsWith('\xef\xbb\xbf')) return payload;
  }
  // Some single-page records only expose the compact payload marker.
  return record.slice(87, 92) === '\x01\x01\x00\x00\x00' ? xmlPayload(record.slice(92)) : '';
}

function densePages(record, cursor, count) {
  const pages = [];
  for (let index = 0; index < count; index++) {
    let size = 0;
    for (let shift = 0; ; shift += 7) {
      if (cursor >= record.length || shift > 14) return '';
      const byte = record.charCodeAt(cursor++);
      size += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) break;
    }
    if (size < 2 || cursor + size > record.length) return '';
    const payload = record.slice(cursor, cursor + size);
    try {
      const page = inflateSync(Buffer.from(payload, 'latin1'), { maxOutputLength: 4096 });
      if (page.length !== 4096) return '';
      pages.push(page.toString('latin1'));
    } catch {
      return '';
    }
    cursor += size;
  }
  return pages.join('');
}

function xmlPayload(bytes) {
  if (bytes.startsWith('\xef\xbb\xbf')) return bytes;
  let prefixLength = 0;
  while (prefixLength < 4 && (bytes.charCodeAt(prefixLength) & 0x80)) prefixLength++;
  const payload = bytes.slice(prefixLength + 1);
  if ((payload.charCodeAt(0) & 0x0f) !== 8) return '';
  try {
    return inflateSync(Buffer.from(payload, 'latin1'), { maxOutputLength: 65536 }).toString('latin1');
  } catch {
    return '';
  }
}

function partKey(block, version, reference) {
  return JSON.stringify([block, version, reference.toLowerCase()]);
}

function crcWord(value) {
  return /^0x[\da-f]{1,8}$/i.test(value) ? parseInt(value, 16).toString(16) : '';
}

function discoverEmbeddedDefinitions(raw, embedded, ambiguous) {
  // Embedded interface snapshots carry the type CRC and layout CRC in the
  // metadata ahead of the compact page. Validate the layout against the XML.
  const marker = /\x10\x01\x00\x00\x00\x01\x01\x00\x00\x00/g;
  for (const match of raw.matchAll(marker)) {
    const offset = match.index;
    if (offset < 64 || raw.slice(offset - 60, offset - 56) !== '\x14\x00\x00\x00' ||
        raw.slice(offset - 14, offset - 11) !== '\x01\x8b\x08') continue;
    const metadata = Buffer.from(raw.slice(offset - 64, offset), 'latin1');
    const crc = metadata.readUInt32LE(0).toString(16);
    const layout = metadata.readUInt32LE(32).toString(16);
    const body = rootPayload.exec(xmlPayload(raw.slice(offset + match[0].length, offset + maxRecordBytes)))?.[1];
    const offsets = body && /<Offsets\b[^>]*>/.exec(body)?.[0];
    if (offsets && crcWord(attribute(offsets, 'CRC')) === layout &&
        Number(attribute(offsets, 'stdSize')) === metadata.readUInt32LE(36)) {
      register(embedded, ambiguous, crc + ':' + layout, utf8(body));
    }
  }
}

function discoverParts(raw, parts, ambiguous) {
  // Structure records share the block GUID and interface version. The payload
  // starts with a UTF-8 BOM or a length prefix followed by a zlib stream.
  const records = /BI:Struct(?:ure)?(\d{1,6}):([^/\x00-\x1f]{1,100})\/(?:(\d{1,6})\/)?([\da-f-]{36})#[\da-f]{1,8}(?=[\s\S]{87}\x01\x01\x00\x00\x00|[\s\S]{79,84}\x10[\x01-\x40]\x00\x00\x00)/gi;
  for (const match of raw.matchAll(records)) {
    const [, index, block, version, reference] = match;
    const start = match.index + match[0].length;
    const xml = interfacePayload(raw.slice(start, start + maxRecordBytes));
    const part = /^\xef\xbb\xbf<Member ParentId="(\d+(?::\d+)*)"[^>]*>([\s\S]*?<Offsets\b[^>]*(?:\/>|>[\s\S]*?<\/Offsets>))<\/Member>/.exec(xml);
    if (!part) continue;
    const key = partKey(utf8(block), version, reference) + ':' + index;
    register(parts, ambiguous, key, { parentId: part[1], body: utf8(part[2]) });
  }
}

function associateSegmentParts(interfaces, parts, ambiguous) {
  // The segment UDT snapshot and its standalone structure records can have
  // different reference GUIDs. Use a unique complete group as a preview.
  const groups = new Map();
  for (const [key, part] of parts) {
    if (!key.startsWith('["UDT_SegmentoEQP",') || ambiguous.has(key)) continue;
    const separator = key.lastIndexOf(':');
    const owner = key.slice(0, separator);
    const group = groups.get(owner) ?? new Map();
    group.set(key.slice(separator + 1), part);
    groups.set(owner, group);
  }
  for (const [owner, { block, body }] of interfaces) {
    if (block !== 'UDT_SegmentoEQP' || groups.has(owner)) continue;
    const members = [...body.matchAll(/<Member\b[^>]*>/g)]
      .map(([token]) => ({ id: attribute(token, 'ID'), index: attribute(token, 'SubPartIndex'),
        offset: attribute(token, 'StdO') }))
      .filter(member => member.id && member.index && /^\d+$/.test(member.offset))
      .sort((a, b) => Number(a.offset) - Number(b.offset));
    const layout = /<Offsets\b[^>]*>/.exec(body)?.[0] ?? '';
    const size = Number(attribute(layout, 'stdSize'));
    if (members.length < 2 || !size) continue;
    const matches = [...groups.values()].filter(group => members.every((member, i) => {
      const part = group.get(member.index);
      if (!part || part.parentId !== member.id) return false;
      const offsets = /<Offsets\b[^>]*>/.exec(part.body)?.[0] ?? '';
      const width = Number(attribute(offsets, 'stdSize'));
      return width > 0 && Number(member.offset) + width <= Number(members[i + 1]?.offset ?? size);
    }));
    if (matches.length !== 1) continue;
    for (const { index } of members) {
      const key = owner + ':' + index;
      if (!parts.has(key) && !ambiguous.has(key)) {
        parts.set(key, { ...matches[0].get(index), unverifiedLayout: true });
      }
    }
  }
}

function register(unique, ambiguous, key, entry) {
  const previous = unique.get(key);
  if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) ambiguous.add(key);
  unique.set(key, entry);
}

function readMembers(body, block, blockRef, unique, ambiguous, parts, ambiguousParts, definitions, ancestry = [], depth = 0, owner = blockRef, idBase = 0, udtPreviews, unverifiedLayout = false) {
  const declarations = body.split(/<Offsets\b/, 1)[0];
  const parents = [...ancestry];
  const externals = body.match(/<Externals\b[^>]*>([\s\S]*?)<\/Externals>/)?.[1] ?? '';
  const externalByPath = new Map();
  for (const [token] of externals.matchAll(/<ExternalType\b[^>]*>[\s\S]*?<\/ExternalType>/g)) {
    const name = attribute(token, 'Name');
    const index = attribute(token, 'SubPartIndex');
    const crc = attribute(token, 'OffsetCRC');
    if (!name || !crc) continue;
    for (const [usage] of token.matchAll(/<Usage\b[^>]*>/g)) {
      const path = attribute(usage, 'Path');
      const key = JSON.stringify([path, name, index]);
      const previous = externalByPath.get(key);
      externalByPath.set(key, previous === undefined || previous === crc ? crc : '');
    }
  }

  for (const [token] of declarations.matchAll(/<\/?Member\b(?:"[^"]*"|'[^']*'|[^<>"'])*>/gu)) {
    if (token.startsWith('</')) {
      if (parents.length > ancestry.length) parents.pop();
      continue;
    }
    const name = attribute(token, 'Name');
    const rid = attribute(token, 'RID');
    let type = attribute(token, 'Type') || attribute(token, 'Datatype') ||
      scalarType(rid) || (rid ? `Tipo interno ${rid}` : '');
    const id = attribute(token, 'ID');
    const chain = [...parents.slice(idBase).map(parent => parent.id), id].join(':');
    const index = attribute(token, 'SubPartIndex');
    const keyPart = owner + ':' + index;
    const candidate = parts?.get(keyPart);
    const childPart = candidate && !ambiguousParts.has(keyPart) && candidate.parentId === chain && depth < 32
      ? candidate : null;
    if (childPart && /^Tipo interno /.test(type)) type = 'Estrutura';
    const standard = attribute(token, 'StdO');
    const parentOffset = parents.at(-1)?.offsetBits ?? (parents.length ? null : 0);
    const localOffset = /^\d{1,8}$/.test(standard) ? Number(standard) : null;
    const offsetBits = parentOffset === null || localOffset === null ? null : parentOffset + localOffset;
    const range = /^Array\s*\[\s*(-?\d{1,7})\s*\.\.\s*(-?\d{1,7})\s*\]\s+of\s+(.+)$/iu.exec(type);
    const segmentArray = range && range[3].trim() === '"UDT_SegmentoEQP"';
    const named = segmentArray ? 'UDT_SegmentoEQP' : /^"([^"]+)"$/.exec(type)?.[1];
    const crc = named && depth < 32 ? externalByPath.get(JSON.stringify([chain, named, index])) : '';
    const definition = crc && definitions?.get(JSON.stringify([named, crcWord(crc)]));
    const preview = !childPart && !definition && crc ? udtPreviews?.get(named) : null;
    const path = [...parents.map(parent => parent.name), name].filter(Boolean).join('.');
    const nestedInArray = parents.some(parent => /^Array\s*\[/i.test(parent.type));
    if (name && type) {
      const entry = { block, name: path, type, nestedInArray };
      if (unverifiedLayout) entry.unverifiedLayout = true;
      if (offsetBits !== null && offsetBits <= 0xffffff) {
        if (unverifiedLayout) entry.suggestedOffsetBits = offsetBits;
        else entry.offsetBits = offsetBits;
      }
      if (range && Number(range[2]) >= Number(range[1])) {
        Object.assign(entry, { first: Number(range[1]), last: Number(range[2]), elementType: range[3].trim() });
      }
      const key = blockRef.toLowerCase() + '/' + path;
      register(unique, ambiguous, key, entry);
    }
    if (segmentArray && name && definition && !unverifiedLayout && !nestedInArray && offsetBits !== null) {
      const layout = /<Offsets\b[^>]*>/.exec(definition.body)?.[0];
      const width = Number(attribute(layout ?? '', 'stdSize'));
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (Number.isSafeInteger(width) && width > 0 && width % 16 === 0 && offsetBits % 16 === 0 &&
          end >= start && end - start < 32 && offsetBits + (end - start + 1) * width <= 0x1000000) {
        for (let item = start; item <= end; item++) {
          const element = { name: `${name}[${item}]`, type: range[3].trim(), id,
            offsetBits: offsetBits + (item - start) * width };
          const elementPath = [...parents.map(parent => parent.name), element.name].join('.');
          register(unique, ambiguous, blockRef.toLowerCase() + '/' + elementPath,
            { block, name: elementPath, type: element.type, offsetBits: element.offsetBits });
          const elementParents = [...parents, element];
          readMembers(definition.body, block, blockRef, unique, ambiguous, parts, ambiguousParts,
            definitions, elementParents, depth + 1, definition.key, elementParents.length, udtPreviews);
        }
      }
    }
    if (!segmentArray && (childPart || definition || preview) && name) {
      const ancestry = [...parents, { name, type, id, offsetBits }];
      const target = definition || preview;
      readMembers(childPart?.body ?? target.body, block, blockRef, unique, ambiguous, parts, ambiguousParts,
        definitions, ancestry, depth + 1, childPart ? owner : target.key, childPart ? idBase : ancestry.length,
        udtPreviews, unverifiedLayout || Boolean(preview || childPart?.unverifiedLayout));
    }
    if (!/\/\s*>$/.test(token)) parents.push({ name, type, id, offsetBits });
  }
}

function attribute(token, name) {
  const value = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(token)?.[1] ?? '';
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return value.replace(/&(amp|quot|apos|lt|gt);/g, (_, entity) => entities[entity]).trim();
}
