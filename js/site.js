// Shared layout, data loading, cart and helpers for every public page.

export const IG_HANDLE = 'finikeragrips';
export const IG_DM = 'https://ig.me/m/finikeragrips';
export const CONTACT_EMAIL = ''; // TODO(owner): set a public contact e-mail to enable mailto fallbacks.

export const MODELS = { colt1911: 'Colt 1911', hipower: 'Hi-Power', beretta92: 'Beretta 92', estuches: 'Estuches' };
export const COLORS = {
  negro: ['Negro', '#1a1a1a'], blanco: ['Blanco perla', '#ece7dc'], azul: ['Azul perla', '#1f3c78'], rojo: ['Rojo', '#8b1a1a'],
  verde: ['Verde', '#2d5a3a'], morado: ['Morado', '#5e2a7e'], cafe: ['Café', '#5c3a22'], dorado: ['Dorado', '#c2a061'],
  plateado: ['Plateado', '#a8a8a8'], madera: ['Madera', '#7b4a1e']
};

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const src = p => (/^(\/|https?:|blob:|data:)/.test(p) ? p : '/' + p);
export const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
export const priceLabel = p => (typeof p === 'number' ? money(p) : 'Precio a consultar');

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
export const session = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ── Data: API copy (admin-edited) with fallback to the static JSON ──────────
async function loadJson(api, file) {
  try {
    const r = await fetch(api, { headers: { accept: 'application/json' } });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return await r.json();
  } catch {}
  const r = await fetch(file);
  return r.json();
}
let catalogP, optionsP;
export const loadCatalog = () => (catalogP ||= loadJson('/api/catalog', '/data/products.json').then(c => ({ ...c, products: c.products.filter(p => p.active !== false) })));
export const loadOptions = () => (optionsP ||= loadJson('/api/options', '/data/case-options.json'));

// ── Cart (localStorage) ────────────────────────────────────────────────────
const CART_KEY = 'fg-cart-v1';
export const cart = {
  items() { return store.get(CART_KEY, []); },
  save(items) { store.set(CART_KEY, items); renderCartCount(); document.dispatchEvent(new CustomEvent('cart:change')); },
  add(id, qty = 1, variant = null) {
    const items = this.items();
    const hit = items.find(i => i.id === id && (i.variant || null) === variant);
    if (hit) hit.qty = Math.min(10, hit.qty + qty); else items.push({ id, variant, qty });
    this.save(items);
  },
  setQty(index, qty) { const items = this.items(); if (!items[index]) return; if (qty < 1) items.splice(index, 1); else items[index].qty = Math.min(10, qty); this.save(items); },
  clear() { this.save([]); },
  count() { return this.items().reduce((s, i) => s + i.qty, 0); }
};

export async function cartLines() {
  const { products } = await loadCatalog();
  return cart.items().map((it, index) => {
    const p = products.find(x => x.id === it.id);
    if (!p) return null;
    const v = it.variant ? (p.variants || []).find(x => x.id === it.variant) : null;
    const unit = v && typeof v.price === 'number' ? v.price : p.price;
    return { index, product: p, variant: v, qty: it.qty, unit: typeof unit === 'number' ? unit : null };
  }).filter(Boolean);
}

// ── Layout ─────────────────────────────────────────────────────────────────
const NAV = [
  ['/shop.html', 'Cachas'], ['/custom-cases.html', 'Estuches a medida'], ['/gallery.html', 'Galería'],
  ['/about.html', 'Taller'], ['/faq.html', 'Ayuda'], ['/contact.html', 'Contacto']
];
const ICON = {
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 8h16M4 16h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m6 6 12 12M18 6 6 18"/></svg>'
};
export { ICON };

function header() {
  const here = location.pathname.replace(/\/$/, '/index.html');
  const links = NAV.map(([h, l]) => `<a href="${h}"${here.endsWith(h) ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  return `
  <a class="skip" href="#main">Saltar al contenido</a>
  <header class="site-header" id="site-header">
    <div class="wrap">
      <a class="brand" href="/" aria-label="Finikera Grips — inicio">FINIKERA <span>GRIPS</span></a>
      <nav class="nav" aria-label="Principal">${links}</nav>
      <div class="header-actions">
        <button class="icon-btn" id="open-cart" aria-label="Abrir pedido">${ICON.bag}<span class="cart-count" id="cart-count"></span></button>
        <button class="icon-btn menu-btn" id="open-menu" aria-label="Abrir menú" aria-expanded="false" aria-controls="drawer-nav">${ICON.menu}</button>
      </div>
    </div>
  </header>
  <nav class="drawer-nav" id="drawer-nav" aria-label="Menú móvil">
    <button class="icon-btn drawer-close" id="close-menu" aria-label="Cerrar menú">${ICON.close}</button>
    <a href="/">Inicio</a>${links}
    <p class="tiny">Phoenix, Arizona · Envíos a todo USA</p>
    <a class="link-arrow small" href="https://instagram.com/${IG_HANDLE}" target="_blank" rel="noopener" style="border:0;font-family:var(--sans)">@${IG_HANDLE}</a>
  </nav>
  <div class="scrim" id="scrim"></div>
  <aside class="cart" id="cart" aria-label="Tu pedido" aria-hidden="true">
    <div class="cart__head"><span class="h3" style="margin:0">Tu pedido</span><button class="icon-btn" id="close-cart" aria-label="Cerrar">${ICON.close}</button></div>
    <div class="cart__items" id="cart-items"></div>
    <div class="cart__foot" id="cart-foot"></div>
  </aside>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

function footer() {
  return `
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <div class="brand" style="margin-bottom:18px">FINIKERA <span>GRIPS</span></div>
          <p class="muted" style="max-width:34ch">Cachas y estuches de presentación hechos a mano en Phoenix, Arizona. Accesorios decorativos — no vendemos armas.</p>
        </div>
        <div><h4>Tienda</h4><ul>
          <li><a href="/shop.html?model=colt1911">Colt 1911</a></li><li><a href="/shop.html?model=hipower">Hi-Power</a></li>
          <li><a href="/shop.html?model=beretta92">Beretta 92</a></li><li><a href="/custom-cases.html">Estuches a medida</a></li></ul></div>
        <div><h4>Ayuda</h4><ul>
          <li><a href="/faq.html">Preguntas frecuentes</a></li><li><a href="/faq.html#envios">Envíos</a></li>
          <li><a href="/faq.html#politicas">Políticas</a></li><li><a href="/contact.html">Contacto</a></li></ul></div>
        <div><h4>Síguenos</h4><ul>
          <li><a href="https://instagram.com/${IG_HANDLE}" target="_blank" rel="noopener">Instagram</a></li>
          <li><a href="${IG_DM}" target="_blank" rel="noopener">Mensaje directo</a></li></ul></div>
      </div>
      <div class="footer-base"><span>© ${new Date().getFullYear()} Finikera Grips · Phoenix, AZ</span><span>Pagos: Zelle · Apple Pay</span></div>
    </div>
  </footer>`;
}

// Copy must start synchronously inside the click handler (iOS Safari), so callers kick it off first.
export function copyText(text) {
  return navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false);
}

// Shows a short "message copied" screen and sends the customer to the Instagram chat.
export async function goToInstagram(text, copied = copyText(text)) {
  const ok = await copied;
  document.querySelectorAll('dialog[open]').forEach(d => d.close()); // modals sit above everything else
  document.body.insertAdjacentHTML('beforeend', `
    <div class="handoff" role="status" aria-live="assertive">
      <p class="eyebrow">${ok ? 'Mensaje copiado' : 'Copia tu mensaje'}</p>
      <p class="h2">${ok ? 'Abriendo Instagram…' : 'Envíanos este mensaje'}</p>
      ${ok ? '<p class="muted">En el chat, mantén presionado → <b>Pegar</b> y envíalo.</p>' : `<textarea readonly class="handoff__text">${esc(text)}</textarea>`}
      <a class="btn" href="${IG_DM}">Abrir Instagram</a>
    </div>`);
  if (ok) setTimeout(() => { location.href = IG_DM; }, 1100);
}

export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 3200);
}

function renderCartCount() {
  const el = $('#cart-count');
  if (el) { const n = cart.count(); el.textContent = n ? String(n) : ''; }
}

async function renderCart() {
  const lines = await cartLines();
  const box = $('#cart-items'), foot = $('#cart-foot');
  if (!lines.length) {
    box.innerHTML = `<div class="empty"><p class="h3">Tu pedido está vacío</p><p class="small">Explora la colección de cachas o diseña tu estuche.</p></div>`;
    foot.innerHTML = `<a class="btn btn--block" href="/shop.html">Ver cachas</a>`;
    return;
  }
  box.innerHTML = lines.map(l => `
    <div class="line">
      <img src="${esc(src(l.product.images[0]))}" alt="" loading="lazy" />
      <div>
        <div class="line__name">${esc(l.product.name)}</div>
        <div class="small muted">${esc(MODELS[l.product.model] || '')}${l.variant ? ' · ' + esc(l.variant.label) : ''}</div>
        <div class="line__ctrl">
          <button data-q="${l.index}" data-d="-1" aria-label="Menos">−</button><span>${l.qty}</span>
          <button data-q="${l.index}" data-d="1" aria-label="Más">+</button>
          <button class="line__remove" data-r="${l.index}">Quitar</button>
        </div>
      </div>
      <div class="small">${l.unit === null ? 'A consultar' : money(l.unit * l.qty)}</div>
    </div>`).join('');
  const priced = lines.every(l => l.unit !== null);
  const total = lines.reduce((s, l) => s + (l.unit || 0) * l.qty, 0);
  foot.innerHTML = `
    <div class="totals"><span>${priced ? 'Subtotal' : 'Subtotal estimado'}</span><b>${priced ? money(total) : 'A confirmar'}</b></div>
    <p class="small muted" style="margin:0">${priced ? 'Envío calculado al confirmar.' : 'Algunas piezas no tienen precio publicado: confirmaremos precio y disponibilidad antes de cobrar.'}</p>
    <a class="btn btn--block" href="/checkout.html">Continuar</a>`;
}

function openCart(open = true) {
  $('#cart').classList.toggle('open', open);
  $('#cart').setAttribute('aria-hidden', String(!open));
  $('#scrim').classList.toggle('show', open);
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) { renderCart(); $('#close-cart').focus(); }
}
export { openCart };

function openMenu(open = true) {
  $('#drawer-nav').classList.toggle('open', open);
  $('#open-menu').setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

export function initReveal(root = document) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal:not(.in)', root).forEach(el => io.observe(el));
}

export function initLayout() {
  document.body.insertAdjacentHTML('afterbegin', header());
  document.body.insertAdjacentHTML('beforeend', footer());
  renderCartCount();
  $('#open-cart').addEventListener('click', () => openCart(true));
  $('#close-cart').addEventListener('click', () => openCart(false));
  $('#scrim').addEventListener('click', () => openCart(false));
  $('#open-menu').addEventListener('click', () => openMenu(true));
  $('#close-menu').addEventListener('click', () => openMenu(false));
  $('#cart').addEventListener('click', e => {
    const q = e.target.closest('[data-q]'), r = e.target.closest('[data-r]');
    if (q) { const i = +q.dataset.q; cart.setQty(i, cart.items()[i].qty + +q.dataset.d); renderCart(); }
    if (r) { cart.setQty(+r.dataset.r, 0); renderCart(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { openCart(false); openMenu(false); } });
  const h = $('#site-header');
  const onScroll = () => h.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  initReveal();
}

// Simple image lightbox shared by gallery, shop and studio.
export function lightbox(images, start = 0, captions = []) {
  let dlg = $('#lightbox');
  if (!dlg) {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog class="lightbox" id="lightbox" aria-label="Imagen ampliada">
        <button class="icon-btn dlg-close" data-close aria-label="Cerrar">${ICON.close}</button>
        <button class="icon-btn gal-nav gal-nav--prev" data-step="-1" aria-label="Anterior">‹</button>
        <img alt="" />
        <button class="icon-btn gal-nav gal-nav--next" data-step="1" aria-label="Siguiente">›</button>
        <span class="count"></span>
      </dialog>`);
    dlg = $('#lightbox');
    dlg.addEventListener('click', e => {
      if (e.target.closest('[data-step]')) dlg._go(+e.target.closest('[data-step]').dataset.step);
      else if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
    dlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') dlg._go(-1); if (e.key === 'ArrowRight') dlg._go(1); });
  }
  let i = start;
  const img = $('img', dlg), count = $('.count', dlg);
  dlg._go = d => { i = (i + d + images.length) % images.length; show(); };
  const show = () => {
    img.src = src(images[i]); img.alt = captions[i] || '';
    count.textContent = images.length > 1 ? `${i + 1} / ${images.length}` : '';
    $$('.gal-nav', dlg).forEach(b => (b.hidden = images.length < 2));
  };
  show();
  dlg.showModal();
}
