// Catalog + studio options: admin-edited copy in Blobs, falling back to the JSON files shipped with the site.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { store } from './store.mjs';

const SITE_ROOT = process.env.FG_SITE_ROOT || process.cwd();

async function bundled(file) {
  return JSON.parse(await fs.readFile(path.join(SITE_ROOT, 'data', file), 'utf8'));
}

export async function getCatalog() {
  const s = await store('config');
  return (await s.get('products.json', { type: 'json' })) || bundled('products.json');
}

export async function getOptions() {
  const s = await store('config');
  return (await s.get('case-options.json', { type: 'json' })) || bundled('case-options.json');
}

export async function saveConfig(name, value) {
  const s = await store('config');
  await s.setJSON(name, value);
}
