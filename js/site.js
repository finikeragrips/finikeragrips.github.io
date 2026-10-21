// Shared layout, data loading and helpers for every public page.

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

// ── Layout ─────────────────────────────────────────────────────────────────
const NAV = [
  ['/shop.html', 'Cachas'], ['/custom-cases.html', 'Estuches a medida'], ['/gallery.html', 'Galería'],
  ['/about.html', 'Taller'], ['/faq.html', 'Ayuda'], ['/contact.html', 'Contacto']
];
const ICON = {
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/></svg>',
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
        <a class="icon-btn" href="${IG_DM}" target="_blank" rel="noopener" aria-label="Escríbenos por Instagram">${ICON.ig}</a>
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
  $('#open-menu').addEventListener('click', () => openMenu(true));
  $('#close-menu').addEventListener('click', () => openMenu(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') openMenu(false); });
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
