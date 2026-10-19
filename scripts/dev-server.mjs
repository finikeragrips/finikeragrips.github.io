// Local preview: serves the static site and runs the API function against a
// local data folder (.data/) instead of Netlify Blobs.
//   ADMIN_TOKEN=change-me-to-a-long-random-string npm run dev
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.FG_LOCAL_STORE ||= path.join(root, '.data');
process.env.FG_SITE_ROOT ||= root;
const { default: api } = await import('../netlify/functions/api.mjs');
const PORT = Number(process.env.PORT || 8888);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.webp': 'image/webp' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
    const r = await api(new Request(url, { method: req.method, headers: req.headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  let p = path.join(root, decodeURIComponent(url.pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    if ((await fs.stat(p)).isDirectory()) p = path.join(p, 'index.html');
    const data = await fs.readFile(p);
    res.writeHead(200, { 'content-type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await fs.readFile(path.join(root, '404.html')).catch(() => 'Not found'));
  }
}).listen(PORT, () => console.log(`Finikera preview → http://localhost:${PORT}`));
