import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { importTiaDatabase } from './tia-import.mjs';

// Increment when extraction semantics change. Application version alone need
// not invalidate an unchanged extractor.
export const parserVersion = 'plf-io-1';
const validId = id => typeof id === 'string' && /^plf-io-1-[a-f0-9]{64}$/.test(id);
export class CatalogStore {
  constructor(directory, parser = importTiaDatabase) { this.directory = directory; this.parser = parser; this.queue = Promise.resolve(); }
  exclusive(work) {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  async atomic(name, value) {
    const temporary = join(this.directory, `${randomUUID()}.tmp`);
    try { await writeFile(temporary, JSON.stringify(value), { flag: 'wx' }); await rename(temporary, join(this.directory, name)); }
    finally { await rm(temporary, { force: true }); }
  }
  async load(id) {
    if (!validId(id)) throw new Error('Identificador de catálogo inválido.');
    const data = JSON.parse(await readFile(join(this.directory, id + '.json'), 'utf8'));
    if (data.catalogo?.id !== id || data.catalogo.parserVersion !== parserVersion || !Array.isArray(data.arrays) || !data.arrays.length || !data.arrays.every(t => t && typeof t.block === 'string' && typeof t.name === 'string' && typeof t.type === 'string')) {
      throw Object.assign(new Error('Catálogo incompatível ou corrompido. Importe o projeto novamente.'), { code: 'ECATALOG' });
    }
    return data;
  }
  async list() {
    await mkdir(this.directory, { recursive: true });
    const items = [];
    for (const file of await readdir(this.directory)) {
      const id = file.endsWith('.meta.json') ? file.slice(0, -10) : '';
      if (!validId(id)) continue;
      try {
        const metadata = JSON.parse(await readFile(join(this.directory, file), 'utf8'));
        if (metadata.id === id && metadata.parserVersion === parserVersion && typeof metadata.createdAt === 'string') items.push(metadata);
      } catch { /* A damaged metadata file is not offered as a saved version. */ }
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async current() {
    try { const { id } = JSON.parse(await readFile(join(this.directory, 'active.json'), 'utf8')); return await this.load(id); }
    catch (error) { if (error.code === 'ENOENT') return { arrays: [], catalogo: null }; throw error; }
  }
  select(id) { return this.exclusive(async () => { const data = await this.load(id); await this.atomic('active.json', { id }); return data; }); }
  remove(id) { return this.exclusive(async () => {
    if (!validId(id)) throw new Error('Identificador de catálogo inválido.');
    await stat(join(this.directory, id + '.json'));
    let active;
    try { active = JSON.parse(await readFile(join(this.directory, 'active.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (active?.id === id) await rm(join(this.directory, 'active.json'), { force: true });
    await rm(join(this.directory, id + '.meta.json'), { force: true });
    await rm(join(this.directory, id + '.json'));
    await rm(join(this.directory, id + '.plf'), { force: true });
    return { removed: id };
  }); }
  import(stream, name = 'Projeto TIA') { return this.exclusive(async () => {
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, randomUUID() + '.upload');
    const hash = createHash('sha256');
    try {
      await pipeline(stream, new Transform({ transform(chunk, encoding, done) { hash.update(chunk); done(null, chunk); } }), createWriteStream(temporary, { flags: 'wx' }));
      const sourceSha256 = hash.digest('hex');
      const id = `${parserVersion}-${sourceSha256}`;
      let data;
      let cached = false;
      try { data = await this.load(id); cached = true; }
      catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ECATALOG' && !(error instanceof SyntaxError)) throw error;
        const arrays = await this.parser(createReadStream(temporary));
        if (!Array.isArray(arrays) || !arrays.length) throw new Error('O projeto não produziu um catálogo válido.');
        const { size } = await stat(temporary);
        data = { arrays, catalogo: { id, name: String(name).trim().slice(0, 120) || 'Projeto TIA', createdAt: new Date().toISOString(),
          sourceSha256, parserVersion, sourceBytes: size, entries: arrays.length, io: arrays.filter(t => t.io).length } };
        await rename(temporary, join(this.directory, id + '.plf'));
        await this.atomic(id + '.json', data);
        await this.atomic(id + '.meta.json', data.catalogo);
      }
      await this.atomic('active.json', { id });
      return { ...data, cached };
    } finally { await rm(temporary, { force: true }); }
  }); }
}
