// API tests against the local filesystem store: `npm test`
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = 'test-token-0123456789-abcdefghij';
process.env.FG_LOCAL_STORE = mkdtempSync(path.join(tmpdir(), 'fg-'));
process.env.FG_SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.ADMIN_TOKEN = TOKEN;
let api;
before(async () => { api = (await import('../netlify/functions/api.mjs')).default; });

const call = (p, init = {}) => api(new Request('http://x/api/' + p, init));
const admin = (p, init = {}) => call('admin/' + p, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) } });
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1]);
const customer = { name: 'Ana Ruiz', email: 'ana@example.com', state: 'Arizona', contactPref: 'instagram', paymentPref: 'zelle' };
function orderForm(payload, files = [], extra = {}) {
  const fd = new FormData();
  fd.append('payload', JSON.stringify(payload));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  files.forEach(f => fd.append('files', f));
  return { method: 'POST', body: fd };
}
const design = { model: 'case-1911', material: 'wood', exterior: 'walnut', hardware: 'gold', lining: 'burgundy', foam: 'fitted', emblem: 'horse', artwork: 'none', placement: 'lid-outside', monogram: 'jmr', text: 'Familia <b>Ruiz</b>', font: 'roman' };

test('public catalog and options', async () => {
  const c = await (await call('catalog')).json();
  assert.equal(c.products.length, 55);
  const o = await (await call('options')).json();
  assert.ok(o.models.length >= 2);
});

test('custom case with artwork + upload becomes a quote request', async () => {
  const r = await call('orders', orderForm({ kind: 'custom-case', consent: true, customer, design: { ...design, artwork: 'portrait', artworkNotes: '' } }, [new File([JPEG], 'ref.jpg', { type: 'image/jpeg' })]));
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.match(j.ref, /^FG-\d{6}-[A-Z2-9]{5}$/);
  assert.equal(j.requestType, 'quote');
  const full = await (await admin('orders/' + j.ref)).json();
  assert.equal(full.design.monogram, 'JMR');
  assert.ok(!full.design.text.includes('<'), 'markup stripped');
  assert.equal(full.uploads.length, 1);
  const img = await admin('uploads/' + full.uploads[0].key);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
});

test('validation: bad email, missing consent, invalid option, fake image', async () => {
  const r = await call('orders', orderForm({ kind: 'custom-case', consent: false, customer: { ...customer, email: 'nope' }, design: { ...design, lining: 'plutonium' } },
    [new File(['<script>alert(1)</script>'], 'x.jpg', { type: 'image/jpeg' })]));
  assert.equal(r.status, 422);
  const { errors } = await r.json();
  assert.ok(errors.some(e => /Correo/.test(e)));
  assert.ok(errors.some(e => /términos/.test(e)));
  assert.ok(errors.some(e => /Forro/.test(e)));
  assert.ok(errors.some(e => /no es una imagen/.test(e)));
});

test('artwork requires a description or reference', async () => {
  const r = await call('orders', orderForm({ kind: 'custom-case', consent: true, customer, design: { ...design, artwork: 'freeform' } }));
  assert.equal(r.status, 422);
});

test('honeypot silently accepted but not stored', async () => {
  const before = (await (await admin('orders')).json()).orders.length;
  const r = await call('orders', orderForm({ kind: 'custom-case', consent: true, customer, design }, [], { website: 'spam.example' }));
  assert.equal(r.status, 200);
  assert.equal((await (await admin('orders')).json()).orders.length, before);
});

test('admin endpoints require the token', async () => {
  assert.equal((await call('admin/orders')).status, 401);
  assert.equal((await call('admin/orders', { headers: { authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await admin('uploads/x/..%2F..%2Fsecret')).status, 400);
  assert.equal((await admin('uploads/../../etc/passwd')).status, 404, 'URL normalisation keeps it outside admin routes');
});

test('pricing rules: estimate appears only when every option is priced', async () => {
  const o = await (await call('options')).json();
  o.models.forEach(m => (m.price = 400));
  o.materials.forEach(m => (m.price = 0));
  o.lidEmblems.forEach(m => (m.price ??= 25));
  o.textPrice = 40;
  assert.equal((await admin('options', { method: 'PUT', body: JSON.stringify(o) })).status, 200);
  const r = await (await call('orders', orderForm({ kind: 'custom-case', consent: true, customer, design }))).json();
  assert.equal(r.requestType, 'order');
  assert.equal(r.estimate.total, 440);
  const bad = await admin('options', { method: 'PUT', body: JSON.stringify({ ...o, models: [{ id: 'X Y', label: '' }] }) });
  assert.equal(bad.status, 422);
});

test('cart orders: unknown products rejected, priced totals computed server-side', async () => {
  assert.equal((await call('orders', orderForm({ kind: 'cart', consent: true, customer, items: [{ id: 'nope', qty: 1 }] }))).status, 422);
  const cat = await (await admin('catalog')).json();
  cat.products[5].price = 150;
  cat.products[5].stock = 2;
  assert.equal((await admin('catalog', { method: 'PUT', body: JSON.stringify(cat) })).status, 200);
  const id = cat.products[5].id;
  assert.equal((await call('orders', orderForm({ kind: 'cart', consent: true, customer, items: [{ id, qty: 3 }] }))).status, 422, 'stock enforced');
  const r = await (await call('orders', orderForm({ kind: 'cart', consent: true, customer, items: [{ id, qty: 2, price: 1 }] }))).json();
  assert.equal(r.estimate.total, 300);
});

test('catalog validation rejects foreign image URLs', async () => {
  const cat = await (await admin('catalog')).json();
  cat.products[0].images = ['https://evil.example/x.jpg'];
  assert.equal((await admin('catalog', { method: 'PUT', body: JSON.stringify(cat) })).status, 422);
});

test('order status update + CSV export neutralises formulas', async () => {
  const r = await (await call('orders', orderForm({ kind: 'custom-case', consent: true, customer: { ...customer, name: '=HYPERLINK("x")' }, design }))).json();
  const p = await admin('orders/' + r.ref, { method: 'PATCH', body: JSON.stringify({ status: 'quoted', quotedPrice: 650, note: 'ok' }) });
  assert.equal((await p.json()).status, 'quoted');
  assert.equal((await admin('orders/' + r.ref, { method: 'PATCH', body: JSON.stringify({ status: 'bogus' }) })).status, 422);
  const csv = await (await admin('orders.csv')).text();
  assert.ok(csv.includes(r.ref));
  assert.ok(csv.includes(`"'=HYPERLINK`));
});

test('product media upload is public; customer uploads are not', async () => {
  const fd = new FormData();
  fd.append('file', new File([JPEG], 'p.jpg'));
  const { url } = await (await admin('media', { method: 'POST', body: fd })).json();
  assert.equal((await call(url.replace('/api/', ''))).status, 200);
  assert.equal((await call('media/uploads/x/ref-1.jpg')).status, 404);
});
