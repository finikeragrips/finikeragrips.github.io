// Admin console: orders, products/inventory, studio options & pricing.
// Auth: ADMIN_TOKEN (Netlify env var), kept in sessionStorage for this tab only.
import { $, $$, esc, src, money, MODELS, COLORS } from './site.js';

const TOKEN_KEY = 'fg-admin-token';
let token = sessionStorage.getItem(TOKEN_KEY) || '';
const STATUS_LABEL = { new: 'Nuevo', reviewing: 'En revisión', quoted: 'Cotizado', 'awaiting-payment': 'Esperando pago', paid: 'Pagado',
  'in-production': 'En producción', shipped: 'Enviado', completed: 'Completado', cancelled: 'Cancelado' };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3000);
}

async function api(path, opts = {}) {
  const res = await fetch('/api/admin/' + path, { ...opts, headers: { authorization: `Bearer ${token}`, ...(opts.body && !(opts.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...opts.headers } });
  if (res.status === 401) { logout('Sesión no válida'); throw new Error('401'); }
  const isJson = (res.headers.get('content-type') || '').includes('json');
  if (!res.ok) {
    const data = isJson ? await res.json() : {};
    throw Object.assign(new Error(data.error || `Error ${res.status}`), { details: data.errors });
  }
  return opts.raw ? res : isJson ? res.json() : res.text();
}
const fail = e => { if (e.message !== '401') toast(e.details ? `${e.message}: ${e.details.slice(0, 3).join(' · ')}` : e.message); };

// ── Auth ───────────────────────────────────────────────────────────────────
function logout(msg) {
  token = ''; sessionStorage.removeItem(TOKEN_KEY);
  $('#login').hidden = false; $('#tabs').hidden = $('#logout').hidden = true;
  $$('[id^="view-"]').forEach(v => (v.hidden = true));
  if (msg) $('#login-msg').textContent = msg;
}
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  token = $('#token').value.trim();
  try {
    const r = await fetch('/api/admin/orders', { headers: { authorization: `Bearer ${token}` } });
    if (r.status === 404 || !(r.headers.get('content-type') || '').includes('json')) { $('#login-msg').textContent = 'La API no está disponible en este hosting. Usa el sitio desplegado en Netlify (ver docs/DEPLOYMENT.md).'; return; }
    if (!r.ok) { $('#login-msg').textContent = 'Token incorrecto.'; return; }
    sessionStorage.setItem(TOKEN_KEY, token);
    start();
  } catch { $('#login-msg').textContent = 'No se pudo conectar con la API.'; }
});
$('#logout').addEventListener('click', () => logout());

function start() {
  $('#login').hidden = true; $('#tabs').hidden = $('#logout').hidden = false;
  show('orders');
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
function show(tab) {
  $$('#tabs [data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
  $$('[id^="view-"]').forEach(v => (v.hidden = v.id !== 'view-' + tab));
  ({ orders: loadOrders, products: loadProducts, options: loadOptionsView })[tab]();
}

// ── Orders ─────────────────────────────────────────────────────────────────
let statusFilter = '';
async function loadOrders() {
  const v = $('#view-orders');
  v.innerHTML = '<p class="muted">Cargando…</p>';
  try {
    const { orders, statuses } = await api('orders' + (statusFilter ? `?status=${statusFilter}` : ''));
    v.innerHTML = `
      <div class="bar"><h1 class="h2" style="margin:0">Pedidos</h1>
        <div><select class="select" id="status-filter"><option value="">Todos los estados</option>${statuses.map(s => `<option value="${s}" ${s === statusFilter ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>
        <button class="btn btn--ghost btn--sm" id="export">Exportar CSV</button></div></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Referencia</th><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Estado</th><th>Estimado</th><th>Cotizado</th><th>Imágenes</th></tr></thead><tbody>
      ${orders.map(o => `<tr data-ref="${esc(o.ref)}"><td>${esc(o.ref)}</td><td>${new Date(o.createdAt).toLocaleString('es-US')}</td>
        <td>${o.kind === 'cart' ? 'Tienda' : 'Estuche'} · ${o.requestType === 'quote' ? 'Cotización' : 'Pedido'}</td>
        <td>${esc(o.name)}<br><span class="muted small">${esc(o.email)}</span></td>
        <td><span class="pill pill--${o.status}">${STATUS_LABEL[o.status]}</span></td>
        <td>${o.total === null ? '—' : money(o.total)}</td><td>${o.quotedPrice === null ? '—' : money(o.quotedPrice)}</td><td>${o.uploads || ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Sin pedidos.</td></tr>'}
      </tbody></table></div>`;
    $('#status-filter').addEventListener('change', e => { statusFilter = e.target.value; loadOrders(); });
    $('#export').addEventListener('click', exportCsv);
    v.querySelector('tbody').addEventListener('click', e => { const r = e.target.closest('[data-ref]'); if (r) openOrder(r.dataset.ref); });
  } catch (e) { fail(e); }
}

async function exportCsv() {
  try {
    const res = await api('orders.csv', { raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: `finikera-pedidos-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { fail(e); }
}

async function openOrder(ref) {
  const v = $('#view-orders');
  try {
    const o = await api('orders/' + ref);
    const c = o.customer;
    v.innerHTML = `
      <div class="bar"><div><button class="btn btn--ghost btn--sm" id="back">← Pedidos</button><h1 class="h2" style="margin:0">${esc(o.ref)}</h1></div>
        <span class="pill pill--${o.status}">${STATUS_LABEL[o.status]}</span></div>
      <div class="detail">
        <div class="card-box">
          <h2 class="h3">${o.kind === 'cart' ? 'Pedido de tienda' : 'Estuche personalizado'} · ${o.requestType === 'quote' ? 'Solicitud de cotización' : 'Pedido'}</h2>
          <table class="summary">${o.summary.map(([k, val]) => `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`).join('')}
            ${o.notes ? `<tr><th>Notas</th><td>${esc(o.notes)}</td></tr>` : ''}
            <tr><th>Estimado del sistema</th><td>${o.estimate?.total == null ? 'Requiere cotización' : money(o.estimate.total)}</td></tr></table>
          ${o.estimate?.reasons?.length ? `<details class="small muted"><summary>Motivos de cotización</summary><ul>${o.estimate.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
          ${o.uploads.length ? `<h3 class="tiny">Imágenes del cliente</h3><div class="uploads" id="uploads"></div>` : ''}
        </div>
        <div class="card-box">
          <h2 class="h3">Cliente</h2>
          <table class="summary">
            <tr><th>Nombre</th><td>${esc(c.name)}</td></tr><tr><th>Correo</th><td><a class="link" href="mailto:${esc(c.email)}">${esc(c.email)}</a></td></tr>
            <tr><th>Teléfono</th><td>${esc(c.phone || '—')}</td></tr><tr><th>Instagram</th><td>${c.instagram ? `<a class="link" href="https://instagram.com/${esc(c.instagram)}" target="_blank" rel="noopener">@${esc(c.instagram)}</a>` : '—'}</td></tr>
            <tr><th>Ubicación</th><td>${esc([c.city, c.state].filter(Boolean).join(', '))}</td></tr>
            <tr><th>Contacto preferido</th><td>${esc(c.contactPref)}</td></tr><tr><th>Pago preferido</th><td>${esc(c.paymentPref)}</td></tr>
          </table>
          <form class="form" id="order-update">
            <div class="form-row">
              <div class="field"><label for="o-status">Estado</label><select id="o-status">${Object.entries(STATUS_LABEL).map(([k, l]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              <div class="field"><label for="o-quote">Precio cotizado (USD)</label><input id="o-quote" type="number" min="0" step="1" value="${o.quotedPrice ?? ''}" /></div>
            </div>
            <div class="field"><label for="o-tracking">Número de seguimiento</label><input id="o-tracking" maxlength="80" value="${esc(o.tracking || '')}" /></div>
            <div class="field"><label for="o-note">Nota interna</label><textarea id="o-note" maxlength="1000"></textarea></div>
            <button class="btn" type="submit">Guardar cambios</button>
          </form>
          <h3 class="tiny">Historial</h3>
          <div class="history">${o.history.slice().reverse().map(h => `<div>${new Date(h.at).toLocaleString('es-US')} — ${esc([h.status && STATUS_LABEL[h.status], h.quotedPrice != null && 'cotizado ' + money(h.quotedPrice), h.tracking && 'tracking ' + h.tracking, h.note].filter(Boolean).join(' · '))}</div>`).join('')}</div>
        </div>
      </div>`;
    $('#back').addEventListener('click', loadOrders);
    $('#order-update').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await api('orders/' + ref, { method: 'PATCH', body: JSON.stringify({ status: $('#o-status').value, quotedPrice: $('#o-quote').value, tracking: $('#o-tracking').value, note: $('#o-note').value }) });
        toast('Pedido actualizado'); openOrder(ref);
      } catch (err) { fail(err); }
    });
    for (const u of o.uploads) {
      const res = await api('uploads/' + u.key, { raw: true });
      const url = URL.createObjectURL(await res.blob());
      $('#uploads').insertAdjacentHTML('beforeend', `<a href="${url}" target="_blank" rel="noopener" download="${esc(o.ref)}-${esc(u.key.split('/').pop())}"><img src="${url}" alt="${esc(u.originalName)}" /></a>`);
    }
  } catch (e) { fail(e); }
}

// ── Products ───────────────────────────────────────────────────────────────
let catalog = null, pq = '';
async function loadProducts() {
  try { catalog = await api('catalog'); renderProducts(); } catch (e) { fail(e); }
}
function renderProducts() {
  const v = $('#view-products');
  const list = catalog.products.map((p, i) => ({ p, i })).filter(({ p }) => !pq || (p.name + ' ' + p.id).toLowerCase().includes(pq.toLowerCase()));
  v.innerHTML = `
    <div class="bar"><h1 class="h2" style="margin:0">Productos <span class="muted small">${catalog.products.length}</span></h1>
      <div><input class="select" id="p-search" placeholder="Buscar…" value="${esc(pq)}" style="background-image:none" />
      <button class="btn btn--ghost btn--sm" id="p-new">Nuevo producto</button><button class="btn btn--sm" id="p-save">Publicar cambios</button></div></div>
    <p class="small muted">Los cambios se guardan en el navegador hasta que pulses <b>Publicar cambios</b>.</p>
    <div class="table-wrap"><table class="data"><thead><tr><th></th><th>Nombre</th><th>Modelo</th><th>Color</th><th>Precio</th><th>Stock</th><th>Variantes</th><th>Visible</th></tr></thead><tbody>
    ${list.map(({ p, i }) => `<tr data-i="${i}"><td><img src="${esc(src(p.images[0] || ''))}" alt="" /></td><td class="wrap-cell">${esc(p.name)}${p.featured ? ' ★' : ''}<br><span class="muted small">${esc(p.id)}</span></td>
      <td>${esc(MODELS[p.model] || p.model)}</td><td>${esc((COLORS[p.color] || [p.color])[0])}</td><td>${p.price == null ? '—' : money(p.price)}</td>
      <td>${p.stock == null ? '—' : p.stock}</td><td>${(p.variants || []).length || ''}</td><td>${p.active === false ? 'No' : 'Sí'}</td></tr>`).join('')}
    </tbody></table></div>`;
  $('#p-search').addEventListener('input', e => { pq = e.target.value; const pos = e.target.selectionStart; renderProducts(); const s = $('#p-search'); s.focus(); s.setSelectionRange(pos, pos); });
  $('#p-new').addEventListener('click', () => editProduct(-1));
  $('#p-save').addEventListener('click', async () => {
    try { const r = await api('catalog', { method: 'PUT', body: JSON.stringify({ products: catalog.products }) }); toast(`Publicado: ${r.count} productos`); } catch (e) { fail(e); }
  });
  v.querySelector('tbody').addEventListener('click', e => { const r = e.target.closest('[data-i]'); if (r) editProduct(+r.dataset.i); });
}

function editProduct(i) {
  const p = i >= 0 ? catalog.products[i] : { id: '', type: 'grip', model: 'colt1911', color: 'negro', name: '', description: '', finish: '', images: [], featured: false, active: true, price: null, stock: null, variants: [] };
  let dlg = $('#p-editor');
  if (!dlg) { document.body.insertAdjacentHTML('beforeend', '<dialog class="editor" id="p-editor"></dialog>'); dlg = $('#p-editor'); }
  const opt = (map, val) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${Array.isArray(l) ? l[0] : l}</option>`).join('');
  dlg.innerHTML = `<form class="form" method="dialog" id="p-form">
    <h2 class="h3">${i >= 0 ? 'Editar producto' : 'Nuevo producto'}</h2>
    <div class="form-row"><div class="field"><label>Nombre</label><input name="name" required maxlength="120" value="${esc(p.name)}" /></div>
      <div class="field"><label>ID (url)</label><input name="id" required pattern="[a-z0-9][a-z0-9-]{1,79}" value="${esc(p.id)}" /></div></div>
    <div class="form-row"><div class="field"><label>Tipo</label><select name="type">${opt({ grip: 'Cachas', case: 'Estuche' }, p.type)}</select></div>
      <div class="field"><label>Modelo</label><select name="model">${opt(MODELS, p.model)}</select></div></div>
    <div class="form-row"><div class="field"><label>Color (filtro)</label><select name="color">${opt(COLORS, p.color)}</select></div>
      <div class="field"><label>Acabado</label><input name="finish" maxlength="80" value="${esc(p.finish)}" /></div></div>
    <div class="field"><label>Descripción</label><textarea name="description" maxlength="600">${esc(p.description)}</textarea></div>
    <div class="form-row"><div class="field"><label>Precio USD (vacío = a consultar)</label><input name="price" type="number" min="0" step="1" value="${p.price ?? ''}" /></div>
      <div class="field"><label>Stock (vacío = sin control)</label><input name="stock" type="number" min="0" step="1" value="${p.stock ?? ''}" /></div></div>
    <div class="field"><label>Imágenes (una ruta por línea; la primera es la principal)</label><textarea name="images">${esc(p.images.join('\n'))}</textarea>
      <label class="btn btn--ghost btn--sm" style="justify-self:start">Subir imagen<input type="file" id="p-upload" accept="image/jpeg,image/png,image/webp" hidden /></label></div>
    <div class="field"><label>Variantes (una por línea: id | etiqueta | precio | stock)</label><textarea name="variants" placeholder="oro | Chapa de oro | 180 | 3">${esc((p.variants || []).map(v => [v.id, v.label, v.price ?? '', v.stock ?? ''].join(' | ')).join('\n'))}</textarea></div>
    <label class="consent"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''} /> Destacado</label>
    <label class="consent"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''} /> Visible en la tienda</label>
    <div class="bar"><div>${i >= 0 ? '<button type="button" class="btn btn--ghost btn--sm" id="p-del">Eliminar</button>' : ''}</div>
      <div><button type="button" class="btn btn--ghost btn--sm" id="p-cancel">Cancelar</button><button class="btn btn--sm" type="submit">Aplicar</button></div></div>
  </form>`;
  const f = $('#p-form');
  if (!p.id) f.name.addEventListener('input', () => { f.id.value = f.name.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); });
  $('#p-cancel').addEventListener('click', () => dlg.close());
  $('#p-del')?.addEventListener('click', () => { if (confirm('¿Eliminar este producto? (Se aplica al publicar)')) { catalog.products.splice(i, 1); dlg.close(); renderProducts(); } });
  $('#p-upload').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { const r = await api('media', { method: 'POST', body: fd }); f.images.value = (f.images.value.trim() + '\n' + r.url).trim(); toast('Imagen subida'); } catch (err) { fail(err); }
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const num = v => (v === '' ? null : Number(v));
    const next = {
      ...p, id: f.id.value.trim(), name: f.name.value.trim(), type: f.type.value, model: f.model.value, color: f.color.value,
      finish: f.finish.value.trim(), description: f.description.value.trim(), price: num(f.price.value), stock: num(f.stock.value),
      images: f.images.value.split('\n').map(s => s.trim()).filter(Boolean), featured: f.featured.checked, active: f.active.checked,
      variants: f.variants.value.split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a[0] && a[1]).map(([id, label, price, stock]) => ({ id, label, price: num(price ?? ''), stock: num(stock ?? '') }))
    };
    if (catalog.products.some((x, j) => x.id === next.id && j !== i)) return toast('Ese ID ya existe');
    if (!next.images.length) return toast('Añade al menos una imagen');
    i >= 0 ? (catalog.products[i] = next) : catalog.products.unshift(next);
    dlg.close(); renderProducts(); toast('Aplicado — recuerda publicar');
  });
  dlg.showModal();
}

// ── Studio options & pricing ───────────────────────────────────────────────
const GROUPS = { models: 'Modelos (precio base)', materials: 'Materiales', exteriorColors: 'Colores exteriores', hardware: 'Herrajes', linings: 'Forros', foam: 'Interior', lidEmblems: 'Emblemas', artwork: 'Pintura a mano' };
async function loadOptionsView() {
  const v = $('#view-options');
  try {
    const opts = await (await fetch('/api/options')).json();
    v.innerHTML = `
      <div class="bar"><h1 class="h2" style="margin:0">Estudio y precios</h1><button class="btn btn--sm" id="o-save">Publicar</button></div>
      <p class="notice">Precio vacío = la opción requiere cotización. “Solo cotización” fuerza cotización aunque tenga precio (ideal para pintura a mano). Un diseño muestra precio estimado solo si <b>todas</b> sus opciones tienen precio.</p>
      <div class="price-grid" id="price-grid" style="margin-top:20px">
        ${Object.entries(GROUPS).map(([g, label]) => `<fieldset><legend>${label}</legend>${opts[g].map((o, i) => `
          <div class="price-row" data-g="${g}" data-i="${i}"><span>${esc(o.label)}${o.verify ? ' <span class="pill">verificar</span>' : ''}</span>
            <input type="number" min="0" step="1" data-f="price" value="${o.price ?? ''}" placeholder="Cotizar" aria-label="Precio ${esc(o.label)}" />
            <label><input type="checkbox" data-f="quote" ${o.quote ? 'checked' : ''} /> Solo cotización</label>
            <label><input type="checkbox" data-f="available" ${o.available !== false ? 'checked' : ''} /> Disponible</label></div>`).join('')}</fieldset>`).join('')}
        <fieldset><legend>Texto / monograma</legend><div class="price-row"><span>Personalización de texto</span><input type="number" min="0" id="text-price" value="${opts.textPrice ?? ''}" placeholder="Cotizar" /></div></fieldset>
      </div>
      <details style="margin-top:28px"><summary class="tiny">Editor avanzado (JSON)</summary>
        <p class="small muted">Añade o quita opciones, colores (hex), fotos de referencia y límites. Se valida al publicar.</p>
        <textarea class="code" id="o-json" spellcheck="false">${esc(JSON.stringify(opts, null, 2))}</textarea></details>`;
    const json = $('#o-json');
    v.oninput = e => {
      const row = e.target.closest('.price-row[data-g]');
      let data; try { data = JSON.parse(json.value); } catch { return toast('El JSON avanzado tiene errores'); }
      if (row) {
        const o = data[row.dataset.g][+row.dataset.i], f = e.target.dataset.f;
        if (f === 'price') o.price = e.target.value === '' ? null : Number(e.target.value);
        if (f === 'quote') e.target.checked ? (o.quote = true) : delete o.quote;
        if (f === 'available') e.target.checked ? delete o.available : (o.available = false);
      } else if (e.target.id === 'text-price') data.textPrice = e.target.value === '' ? null : Number(e.target.value);
      else return;
      json.value = JSON.stringify(data, null, 2);
    };
    $('#o-save').addEventListener('click', async () => {
      let data; try { data = JSON.parse(json.value); } catch { return toast('JSON inválido'); }
      try { await api('options', { method: 'PUT', body: JSON.stringify(data) }); toast('Opciones publicadas'); loadOptionsView(); } catch (e) { fail(e); }
    });
  } catch (e) { fail(e); }
}

if (token) start();
