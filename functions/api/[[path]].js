// Cloudflare Pages Function for /api/*. Bindings (Pages → Settings → Bindings):
//   FG_KV       KV namespace (orders, uploads, media, admin-edited catalog/options)
//   ADMIN_TOKEN secret, ≥24 random characters
import { createHandler } from '../../server/handler.mjs';
import { kvStore } from '../../server/stores/kv.mjs';

export async function onRequest({ request, env }) {
  if (!env.FG_KV) return new Response(JSON.stringify({ error: 'Falta la conexión FG_KV' }), { status: 503, headers: { 'content-type': 'application/json' } });
  const handle = createHandler({
    store: name => kvStore(env.FG_KV, name),
    bundled: async file => (await env.ASSETS.fetch(new URL(`/data/${file}`, request.url))).json(),
    env
  });
  return handle(request);
}
