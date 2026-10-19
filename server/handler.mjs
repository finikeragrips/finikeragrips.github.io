// Finikera Grips API — platform-neutral request handler (Web Request → Response).
// Wrapped by netlify/functions/api.mjs, functions/api/[[path]].js (Cloudflare) and server/node.mjs.
//
// Public:  GET  /api/catalog            GET /api/options
//          POST /api/orders              GET /api/media/<key>
// Admin (Authorization: Bearer ADMIN_TOKEN):
//          GET   /api/admin/orders[?status=]     GET /api/admin/orders.csv
//          GET   /api/admin/orders/<ref>         PATCH /api/admin/orders/<ref>
//          GET   /api/admin/uploads/<ref>/<file>
//          PUT   /api/admin/catalog              PUT /api/admin/options
//          POST  /api/admin/media
import { json, error, isAdmin, sniffImage, clean, EMAIL_RE } from './http.mjs';
import { notifyOrder } from './notify.mjs';
import { normalizeDesign, estimate, describe } from '../js/lib/case-config.mjs';

// deps: { store(name) → blob store, bundled(file) → bundled data JSON, env: { ADMIN_TOKEN, … } }
let D;
export function createHandler(deps) {
  return req => { D = deps; return handler(req); };
}
const store = name => D.store(name);
const getCatalog = async () => (await store('config').get('products.json', { type: 'json' })) || D.bundled('products.json');
const getOptions = async () => (await store('config').get('case-options.json', { type: 'json' })) || D.bundled('case-options.json');
const saveConfig = (name, value) => store('config').setJSON(name, value);
const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

export const STATUSES = ['new', 'reviewing', 'quoted', 'awaiting-payment', 'paid', 'in-production', 'shipped', 'completed', 'cancelled'];
const CONTACT_PREFS = ['instagram', 'email', 'phone', 'whatsapp'];
const PAYMENT_PREFS = ['zelle', 'apple-pay', 'other'];
const MAX_BODY = 5_500_000; // Netlify synchronous functions accept ~6 MB request bodies.

async function handler(req) {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/(\.netlify\/functions\/)?api\/?/, '');
  const m = req.method;
  try {
    if (m === 'GET' && route === 'catalog') return json(publicCatalog(await getCatalog()), 200, { 'cache-control': 'public, max-age=60' });
    if (m === 'GET' && route === 'options') return json(await getOptions(), 200, { 'cache-control': 'public, max-age=60' });
    if (m === 'POST' && route === 'orders') return await createOrder(req);
    if (m === 'GET' && route.startsWith('media/')) return await serveBlob('media', route.slice(6), true);

    if (route.startsWith('admin/')) {
      if (!(await isAdmin(req, D.env))) return error(401, 'No autorizado');
      const r = route.slice(6);
      if (m === 'GET' && r === 'orders') return json(await listOrders(url.searchParams.get('status')));
      if (m === 'GET' && r === 'orders.csv') return await exportCsv();
      if (r.startsWith('orders/')) {
        const ref = r.slice(7);
        if (!/^FG-\d{6}-[A-Z2-9]{5}$/.test(ref)) return error(400, 'Referencia inválida');
        if (m === 'GET') return await getOrder(ref);
        if (m === 'PATCH') return await updateOrder(ref, req);
      }
      if (m === 'GET' && r.startsWith('uploads/')) return await serveBlob('uploads', r.slice(8), false);
      if (m === 'GET' && r === 'catalog') return json(await getCatalog());
      if (m === 'PUT' && r === 'catalog') return await putCatalog(req);
      if (m === 'PUT' && r === 'options') return await putOptions(req);
      if (m === 'POST' && r === 'media') return await uploadMedia(req);
    }
    return error(404, 'No encontrado');
  } catch (e) {
    console.error(e);
    return error(500, 'Error interno');
  }
}


// ── Catalog ────────────────────────────────────────────────────────────────
function publicCatalog(cat) {
  return { ...cat, products: cat.products.filter(p => p.active !== false) };
}

const IMG_PATH = /^(assets\/[\w.-]+\.(jpe?g|png|webp)|\/api\/media\/product\/[\w.-]+)$/i;

function validateProduct(p, i) {
  const errs = [];
  const id = clean(p.id, 80);
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) errs.push(`#${i + 1}: id inválido`);
  const type = p.type === 'case' ? 'case' : 'grip';
  const num = (v, label, int) => {
    if (v === null || v === '' || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || (int && !Number.isInteger(n))) { errs.push(`#${i + 1}: ${label} inválido`); return null; }
    return n;
  };
  const images = (Array.isArray(p.images) ? p.images : []).map(s => String(s).trim()).filter(Boolean);
  if (!images.length) errs.push(`#${i + 1}: requiere al menos una imagen`);
  images.forEach(s => { if (!IMG_PATH.test(s)) errs.push(`#${i + 1}: ruta de imagen no permitida (${clean(s, 60)})`); });
  const variants = (Array.isArray(p.variants) ? p.variants : []).slice(0, 30).map(v => ({
    id: clean(v.id, 40), label: clean(v.label, 80), price: num(v.price, 'precio de variante'), stock: num(v.stock, 'stock de variante', true)
  })).filter(v => v.id && v.label);
  return {
    errs,
    product: {
      id, type, model: clean(p.model, 40), color: clean(p.color, 40), name: clean(p.name, 120),
      description: clean(p.description, 600), finish: clean(p.finish, 80), images: images.slice(0, 30),
      featured: !!p.featured, active: p.active !== false,
      price: num(p.price, 'precio'), stock: num(p.stock, 'stock', true), variants
    }
  };
}

async function putCatalog(req) {
  const body = await readJson(req, 1_000_000);
  if (!body || !Array.isArray(body.products) || body.products.length > 2000) return error(400, 'Formato inválido');
  const errors = [], products = [], ids = new Set();
  body.products.forEach((p, i) => {
    const { errs, product } = validateProduct(p || {}, i);
    if (!product.name) errs.push(`#${i + 1}: nombre requerido`);
    if (ids.has(product.id)) errs.push(`#${i + 1}: id duplicado (${product.id})`);
    ids.add(product.id);
    errors.push(...errs); products.push(product);
  });
  if (errors.length) return error(422, 'Errores de validación', { errors: errors.slice(0, 50) });
  await saveConfig('products.json', { currency: 'USD', updatedAt: new Date().toISOString(), products });
  return json({ ok: true, count: products.length });
}

async function putOptions(req) {
  const body = await readJson(req, 200_000);
  const required = ['models', 'materials', 'exteriorColors', 'hardware', 'linings', 'foam', 'lidEmblems', 'artwork', 'artworkPlacements', 'textFonts'];
  const errors = [];
  if (!body || typeof body !== 'object') return error(400, 'Formato inválido');
  for (const k of required) {
    if (!Array.isArray(body[k]) || !body[k].length) { errors.push(`${k}: debe ser una lista no vacía`); continue; }
    body[k].forEach((o, i) => {
      if (!o || !/^[a-z0-9-]{1,40}$/.test(o.id || '')) errors.push(`${k}[${i}]: id inválido`);
      if (!o || !clean(o.label, 120)) errors.push(`${k}[${i}]: label requerido`);
      if (o && 'price' in o && o.price !== null && !(Number.isFinite(o.price) && o.price >= 0)) errors.push(`${k}[${i}]: price debe ser número ≥ 0 o null`);
      if (o && o.hex && !/^#[0-9a-f]{6}$/i.test(o.hex)) errors.push(`${k}[${i}]: hex inválido`);
    });
  }
  if (body.textPrice !== null && body.textPrice !== undefined && !(Number.isFinite(body.textPrice) && body.textPrice >= 0)) errors.push('textPrice inválido');
  if (errors.length) return error(422, 'Errores de validación', { errors: errors.slice(0, 50) });
  await saveConfig('case-options.json', body);
  return json({ ok: true });
}

// ── Orders ─────────────────────────────────────────────────────────────────
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newRef() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rnd = [...randomBytes(5)].map(b => ALPHABET[b % ALPHABET.length]).join('');
  return `FG-${ymd}-${rnd}`;
}

function validateCustomer(c = {}) {
  const errors = [];
  const customer = {
    name: clean(c.name, 80), email: clean(c.email, 254).toLowerCase(), phone: clean(c.phone, 30),
    instagram: clean(c.instagram, 40).replace(/^@/, ''), state: clean(c.state, 40), city: clean(c.city, 60),
    contactPref: CONTACT_PREFS.includes(c.contactPref) ? c.contactPref : 'email',
    paymentPref: PAYMENT_PREFS.includes(c.paymentPref) ? c.paymentPref : 'zelle'
  };
  if (customer.name.length < 2) errors.push('Nombre requerido');
  if (!EMAIL_RE.test(customer.email)) errors.push('Correo electrónico inválido');
  if (customer.phone && !/^[+\d\s().-]{7,30}$/.test(customer.phone)) errors.push('Teléfono inválido');
  if (customer.instagram && !/^[\w.]{1,30}$/.test(customer.instagram)) errors.push('Usuario de Instagram inválido');
  if (!customer.state) errors.push('Estado requerido');
  return { customer, errors };
}

async function createOrder(req) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BODY) return error(413, 'Archivos demasiado grandes');
  let form;
  try { form = await req.formData(); } catch { return error(400, 'Formulario inválido'); }
  if (form.get('website')) return json({ ok: true, ref: newRef() }); // honeypot: pretend success for bots

  let payload;
  try { payload = JSON.parse(String(form.get('payload') || '{}')); } catch { return error(400, 'Datos inválidos'); }
  const kind = payload.kind === 'cart' ? 'cart' : 'custom-case';
  const { customer, errors } = validateCustomer(payload.customer);
  if (payload.consent !== true) errors.push('Debes aceptar los términos');

  const options = await getOptions();
  const lim = options.limits || {};
  const files = form.getAll('files').filter(f => f && typeof f === 'object' && f.size > 0);
  if (kind === 'cart' && files.length) errors.push('Este pedido no admite archivos');
  if (files.length > (lim.uploads || 3)) errors.push(`Máximo ${lim.uploads || 3} imágenes`);
  const uploads = [];
  for (const f of files.slice(0, lim.uploads || 3)) {
    if (f.size > (lim.uploadBytes || 1_800_000)) { errors.push(`"${clean(f.name, 60)}" supera el tamaño máximo`); continue; }
    const bytes = await f.arrayBuffer();
    const kindOf = sniffImage(bytes);
    if (!kindOf) { errors.push(`"${clean(f.name, 60)}" no es una imagen JPG, PNG o WebP`); continue; }
    uploads.push({ bytes, ...kindOf, originalName: clean(f.name, 80) });
  }

  let order;
  const ref = newRef();
  const now = new Date().toISOString();
  if (kind === 'custom-case') {
    const { design, errors: dErr } = normalizeDesign({ ...payload.design, _hasUploads: uploads.length > 0 }, options);
    errors.push(...dErr);
    if (errors.length) return error(422, 'Revisa los datos', { errors });
    const est = estimate(design, options);
    order = { ref, kind, status: 'new', createdAt: now, customer, design, estimate: est,
      requestType: est.status === 'estimate' ? 'order' : 'quote', summary: describe(design, options) };
  } else {
    const catalog = await getCatalog();
    const items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 25);
    if (!items.length) errors.push('El carrito está vacío');
    const lines = [];
    for (const it of items) {
      const p = catalog.products.find(x => x.id === it.id && x.active !== false);
      const qty = Math.trunc(Number(it.qty));
      if (!p) { errors.push('Un producto ya no está disponible'); continue; }
      if (!(qty >= 1 && qty <= 10)) { errors.push(`Cantidad inválida para ${p.name}`); continue; }
      const v = it.variant ? (p.variants || []).find(x => x.id === it.variant) : null;
      if (it.variant && !v) { errors.push(`Variante no disponible para ${p.name}`); continue; }
      const unit = v && typeof v.price === 'number' ? v.price : p.price;
      const stock = v ? v.stock : p.stock;
      if (typeof stock === 'number' && stock < qty) errors.push(`${p.name}: solo quedan ${stock}`);
      lines.push({ id: p.id, name: p.name + (v ? ` — ${v.label}` : ''), variant: v ? v.id : null, qty, unitPrice: typeof unit === 'number' ? unit : null });
    }
    if (errors.length) return error(422, 'Revisa los datos', { errors });
    const priced = lines.every(l => l.unitPrice !== null);
    const total = priced ? lines.reduce((s, l) => s + l.unitPrice * l.qty, 0) : null;
    order = { ref, kind, status: 'new', createdAt: now, customer, items: lines,
      notes: clean(payload.notes, 1000), estimate: { status: priced ? 'estimate' : 'quote', total },
      requestType: priced ? 'order' : 'quote',
      summary: lines.map(l => [`${l.qty} × ${l.name}`, l.unitPrice === null ? 'Precio a confirmar' : `$${l.unitPrice * l.qty}`]) };
  }

  const up = store('uploads');
  order.uploads = [];
  for (const [i, u] of uploads.entries()) {
    const key = `${ref}/ref-${i + 1}.${u.ext}`;
    await up.set(key, u.bytes, { metadata: { contentType: u.type, originalName: u.originalName } });
    order.uploads.push({ key, contentType: u.type, originalName: u.originalName, bytes: u.bytes.byteLength });
  }
  order.history = [{ at: now, status: 'new', note: 'Pedido recibido' }];
  await (store('orders')).setJSON(`${ref}.json`, order);
  await notifyOrder(order, D.env);
  return json({ ok: true, ref, status: order.status, requestType: order.requestType, estimate: order.estimate, summary: order.summary }, 201);
}

async function loadOrders() {
  const s = store('orders');
  const { blobs } = await s.list();
  const all = await Promise.all(blobs.filter(b => b.key.endsWith('.json')).map(b => s.get(b.key, { type: 'json' })));
  return all.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listOrders(status) {
  const orders = await loadOrders();
  return {
    statuses: STATUSES,
    orders: orders.filter(o => !status || o.status === status).map(o => ({
      ref: o.ref, kind: o.kind, status: o.status, createdAt: o.createdAt, requestType: o.requestType,
      name: o.customer.name, email: o.customer.email, total: o.estimate?.total ?? null, quotedPrice: o.quotedPrice ?? null,
      uploads: o.uploads.length
    }))
  };
}

async function getOrder(ref) {
  const o = await (store('orders')).get(`${ref}.json`, { type: 'json' });
  return o ? json(o) : error(404, 'Pedido no encontrado');
}

async function updateOrder(ref, req) {
  const s = store('orders');
  const o = await s.get(`${ref}.json`, { type: 'json' });
  if (!o) return error(404, 'Pedido no encontrado');
  const body = await readJson(req, 20_000) || {};
  const entry = { at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return error(422, 'Estado inválido');
    o.status = entry.status = body.status;
  }
  if (body.quotedPrice !== undefined) {
    const n = body.quotedPrice === null || body.quotedPrice === '' ? null : Number(body.quotedPrice);
    if (n !== null && !(Number.isFinite(n) && n >= 0)) return error(422, 'Precio inválido');
    o.quotedPrice = entry.quotedPrice = n;
  }
  if (body.tracking !== undefined) o.tracking = entry.tracking = clean(body.tracking, 80);
  if (body.note) entry.note = clean(body.note, 1000);
  o.history.push(entry);
  o.updatedAt = entry.at;
  await s.setJSON(`${ref}.json`, o);
  return json(o);
}

async function exportCsv() {
  const orders = await loadOrders();
  const cell = v => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['ref', 'created_at', 'kind', 'request_type', 'status', 'name', 'email', 'phone', 'instagram', 'state', 'city', 'contact_pref', 'payment_pref', 'estimate_total', 'quoted_price', 'tracking', 'uploads', 'details'];
  const rows = orders.map(o => [o.ref, o.createdAt, o.kind, o.requestType, o.status, o.customer.name, o.customer.email, o.customer.phone,
    o.customer.instagram, o.customer.state, o.customer.city, o.customer.contactPref, o.customer.paymentPref, o.estimate?.total ?? '',
    o.quotedPrice ?? '', o.tracking ?? '', o.uploads.length, o.summary.map(([k, v]) => `${k}: ${v}`).join(' | ')]);
  const csv = '﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="finikera-pedidos-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
}

// ── Media ──────────────────────────────────────────────────────────────────
async function uploadMedia(req) {
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY) return error(413, 'Archivo demasiado grande');
  const form = await req.formData().catch(() => null);
  const f = form && form.get('file');
  if (!f || typeof f !== 'object') return error(400, 'Falta el archivo');
  const bytes = await f.arrayBuffer();
  const t = sniffImage(bytes);
  if (!t) return error(422, 'Solo JPG, PNG o WebP');
  const key = `product/${hex(randomBytes(9))}.${t.ext}`;
  await (store('media')).set(key, bytes, { metadata: { contentType: t.type } });
  return json({ ok: true, url: `/api/media/${key}` }, 201);
}

async function serveBlob(storeName, key, isPublic) {
  if (!/^[\w-]+(\/[\w.-]+)+$/.test(key) || key.includes('..')) return error(400, 'Clave inválida');
  if (isPublic && !key.startsWith('product/')) return error(404, 'No encontrado');
  const res = await (store(storeName)).getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res) return error(404, 'No encontrado');
  const type = ['image/jpeg', 'image/png', 'image/webp'].includes(res.metadata?.contentType) ? res.metadata.contentType : 'application/octet-stream';
  return new Response(res.data, { headers: {
    'content-type': type, 'x-content-type-options': 'nosniff',
    'cache-control': isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store',
    'content-security-policy': "default-src 'none'"
  } });
}

async function readJson(req, max) {
  const text = await req.text();
  if (text.length > max) return null;
  try { return JSON.parse(text); } catch { return null; }
}
