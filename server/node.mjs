// Node entry for local preview and tests: filesystem store + data files from the repo.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './handler.mjs';
import { fsStore } from './stores/fs.mjs';

export function nodeHandler({ root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dataDir = path.join(root, '.data'), env = process.env } = {}) {
  return createHandler({
    store: name => fsStore(dataDir, name),
    bundled: async file => JSON.parse(await fs.readFile(path.join(root, 'data', file), 'utf8')),
    env
  });
}
