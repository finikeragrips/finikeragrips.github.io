// Product card + product detail dialog, shared by the home page and the shop.
import { $, $$, esc, img, MODELS, COLORS, priceLabel, ICON, goToInstagram } from './site.js';

export function cardHTML(p) {
  const [colorName, hex] = COLORS[p.color] || [p.finish || '', '#555'];
  const soldOut = typeof p.stock === 'number' && p.stock <= 0;
  const badge = soldOut ? 'Agotado' : p.images.length > 1 ? `${p.images.length} fotos` : p.featured ? 'Destacado' : '';
  return `
    <button class="card reveal" data-id="${esc(p.id)}" aria-label="${esc(p.name)} — ver detalles">
      <div class="card__media">
        <img src="${esc(img(p.images[0]))}" alt="${esc(p.name)}" loading="lazy" decoding="async" />
        ${badge ? `<span class="card__badge">${esc(badge)}</span>` : ''}
      </div>
      <div class="card__body">
        <span class="tiny">${esc(MODELS[p.model] || p.model)}</span>
        <span class="card__name">${esc(p.name)}</span>
        <span class="card__meta"><span><span class="swatch" style="background:${esc(hex)}"></span>${esc(p.finish || colorName)}</span><span>${esc(priceLabel(p.price))}</span></span>
      </div>
    </button>`;
}

let dlg;
function ensureDialog() {
  if (dlg) return dlg;
  document.body.insertAdjacentHTML('beforeend', `<dialog id="product-dialog" aria-labelledby="pd-title"></dialog>`);
  dlg = $('#product-dialog');
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  dlg.addEventListener('close', () => {
    const u = new URL(location.href);
    if (u.searchParams.has('p')) { u.searchParams.delete('p'); history.replaceState(null, '', u); }
  });
  return dlg;
}

export function openProduct(p) {
  const d = ensureDialog();
  const soldOut = typeof p.stock === 'number' && p.stock <= 0;
  const variants = (p.variants || []);
  d.innerHTML = `
    <div class="pd">
      <div class="pd__gallery">
        <button class="icon-btn dlg-close" data-close aria-label="Cerrar">${ICON.close}</button>
        <img class="pd__main" src="${esc(img(p.images[0], 1080))}" alt="${esc(p.name)}" />
        ${p.images.length > 1 ? `<div class="pd__thumbs">${p.images.map((im, i) => `<button data-img="${i}" aria-current="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(img(im))}" alt="" loading="lazy" /></button>`).join('')}</div>` : ''}
      </div>
      <div class="pd__info">
        <p class="eyebrow" style="margin:0">${esc(MODELS[p.model] || p.model)}</p>
        <h2 class="h2" id="pd-title" style="margin:0">${esc(p.name)}</h2>
        <div class="pd__price" id="pd-price">${esc(priceLabel(p.price))}</div>
        <p class="muted" style="margin:0">${esc(p.description)}</p>
        <dl>
          <dt>Acabado</dt><dd>${esc(p.finish || '—')}</dd>
          <dt>Compatible con</dt><dd>${esc(MODELS[p.model] || p.model)}</dd>
          <dt>Disponibilidad</dt><dd>${soldOut ? 'Agotado — puedes solicitarlo' : typeof p.stock === 'number' ? `${p.stock} en existencia` : 'Confirmamos al recibir tu pedido'}</dd>
        </dl>
        ${variants.length ? `<div class="field"><label for="pd-variant">Opción</label><select id="pd-variant">${variants.map(v => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('')}</select></div>` : ''}
        <div class="buy-row">
          <div class="qty"><button data-qd="-1" aria-label="Menos">−</button><input id="pd-qty" type="number" min="1" max="10" value="1" aria-label="Cantidad" /><button data-qd="1" aria-label="Más">+</button></div>
          <button class="btn" id="pd-ig">Pedir por Instagram</button>
        </div>
        ${p.type === 'case' ? '<a class="link-arrow small" href="/custom-cases.html">O diseña uno a tu medida</a>' : ''}
        <p class="notice">Verifica el modelo exacto de tu pistola antes de pedir. Si tienes dudas, escríbenos y te ayudamos a elegir.</p>
      </div>
    </div>`;
  const main = $('.pd__main', d);
  d.addEventListener('click', e => {
    const t = e.target.closest('[data-img]');
    if (t) { main.src = img(p.images[+t.dataset.img], 1080); $$('[data-img]', d).forEach(b => b.setAttribute('aria-current', String(b === t))); }
  });
  const qty = $('#pd-qty', d);
  $$('[data-qd]', d).forEach(b => b.addEventListener('click', () => { qty.value = Math.max(1, Math.min(10, (+qty.value || 1) + +b.dataset.qd)); }));
  const vSel = $('#pd-variant', d);
  vSel?.addEventListener('change', () => {
    const v = variants.find(x => x.id === vSel.value);
    $('#pd-price', d).textContent = priceLabel(v && typeof v.price === 'number' ? v.price : p.price);
  });
  $('#pd-ig', d).addEventListener('click', () => {
    const v = vSel ? variants.find(x => x.id === vSel.value) : null;
    const n = Math.max(1, Math.min(10, +qty.value || 1));
    const msg = `Hola Finikera Grips 👋 Me interesa: «${p.name}»${v ? ` — ${v.label}` : ''} (${MODELS[p.model] || p.model})` +
      `${n > 1 ? `, cantidad: ${n}` : ''}. ¿Precio y disponibilidad?\n${location.origin}/shop.html?p=${p.id}`;
    goToInstagram(msg);
  });
  const u = new URL(location.href);
  u.searchParams.set('p', p.id);
  history.replaceState(null, '', u);
  d.showModal();
}

export function bindCards(container, products) {
  container.addEventListener('click', e => {
    const c = e.target.closest('.card[data-id]');
    if (!c) return;
    const p = products.find(x => x.id === c.dataset.id);
    if (p) openProduct(p);
  });
}
