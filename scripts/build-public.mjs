// Copies only the public website into dist/ (Cloudflare Pages output directory),
// so source photos (HEIC), server code, tests and docs are never published.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const PUBLIC = ['assets', 'css', 'js', 'data', 'admin', 'robots.txt', 'sitemap.xml', '_headers'];
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out);
for (const f of await fs.readdir(root)) if (f.endsWith('.html')) PUBLIC.push(f);
for (const p of PUBLIC) await fs.cp(path.join(root, p), path.join(out, p), { recursive: true });
console.log(`dist/ ready (${PUBLIC.length} entries)`);
