// Netlify entry: Netlify Blobs storage, data files bundled via netlify.toml `included_files`.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getStore } from '@netlify/blobs';
import { createHandler } from '../../server/handler.mjs';

const handle = createHandler({
  store: name => getStore({ name, consistency: 'strong' }),
  bundled: async file => JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', file), 'utf8')),
  env: process.env
});

export default req => handle(req);
export const config = { path: '/api/*' };
