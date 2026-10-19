// Cloudflare Workers KV adapter exposing the Netlify Blobs-style interface the handler uses.
// Note: KV is eventually consistent — admin edits can take up to ~60 s to show everywhere.
export function kvStore(kv, name) {
  const k = key => `${name}/${key}`;
  return {
    async get(key, opts = {}) {
      return kv.get(k(key), { type: opts.type === 'json' ? 'json' : opts.type === 'arrayBuffer' ? 'arrayBuffer' : 'text' });
    },
    async getWithMetadata(key, opts = {}) {
      const { value, metadata } = await kv.getWithMetadata(k(key), { type: opts.type === 'arrayBuffer' ? 'arrayBuffer' : 'text' });
      return value === null ? null : { data: value, metadata: metadata || {} };
    },
    async set(key, value, opts = {}) { await kv.put(k(key), value, opts.metadata ? { metadata: opts.metadata } : {}); },
    async setJSON(key, value) { await kv.put(k(key), JSON.stringify(value)); },
    async delete(key) { await kv.delete(k(key)); },
    async list({ prefix = '' } = {}) {
      const blobs = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: k(prefix), cursor });
        page.keys.forEach(x => blobs.push({ key: x.name.slice(name.length + 1) }));
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return { blobs };
    }
  };
}
