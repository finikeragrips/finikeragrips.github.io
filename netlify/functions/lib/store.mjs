// Storage adapter. Production: Netlify Blobs. Local dev/tests: a directory on disk
// (set FG_LOCAL_STORE=/path) so the API runs without Netlify.
import { promises as fs } from 'node:fs';
import path from 'node:path';

function fsStore(name) {
  const root = path.join(process.env.FG_LOCAL_STORE, name);
  const file = key => {
    const p = path.join(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error('bad key');
    return p;
  };
  return {
    async get(key, opts = {}) {
      try {
        const buf = await fs.readFile(file(key));
        if (opts.type === 'json') return JSON.parse(buf.toString('utf8'));
        if (opts.type === 'arrayBuffer') return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        return buf.toString('utf8');
      } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    },
    async getWithMetadata(key, opts = {}) {
      const data = await this.get(key, opts);
      if (data === null) return null;
      let metadata = {};
      try { metadata = JSON.parse(await fs.readFile(file(key) + '.meta', 'utf8')); } catch {}
      return { data, metadata };
    },
    async set(key, value, opts = {}) {
      await fs.mkdir(path.dirname(file(key)), { recursive: true });
      await fs.writeFile(file(key), Buffer.from(typeof value === 'string' ? value : new Uint8Array(value)));
      if (opts.metadata) await fs.writeFile(file(key) + '.meta', JSON.stringify(opts.metadata));
    },
    async setJSON(key, value) { return this.set(key, JSON.stringify(value)); },
    async delete(key) { await fs.rm(file(key), { force: true }); },
    async list({ prefix = '' } = {}) {
      const out = [];
      async function walk(dir) {
        let entries = [];
        try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) await walk(p);
          else if (!p.endsWith('.meta')) out.push({ key: path.relative(root, p).split(path.sep).join('/') });
        }
      }
      await walk(root);
      return { blobs: out.filter(b => b.key.startsWith(prefix)) };
    }
  };
}

export async function store(name) {
  if (process.env.FG_LOCAL_STORE) return fsStore(name);
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name, consistency: 'strong' });
}
