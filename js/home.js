import { initLayout, loadCatalog, initReveal, $, esc, img } from './site.js';
import { cardHTML, bindCards, openProduct } from './products.js';

initLayout();
const grid = $('#featured');
const heroImg = $('#hero-img');
const LAST_KEY = 'fg-hero-last';
// If the catalog is slow, show the default photo rather than an empty hero.
const fallback = setTimeout(() => heroImg.classList.remove('is-pending'), 1500);

loadCatalog().then(({ products }) => {
  // Hero: a different piece on every visit (never the same as last time).
  let last = null;
  try { last = localStorage.getItem(LAST_KEY); } catch {}
  const pool = products.filter(p => p.images.length && p.id !== last);
  const hero = pool[Math.floor(Math.random() * pool.length)];
  if (hero) {
    try { localStorage.setItem(LAST_KEY, hero.id); } catch {}
    const show = () => { clearTimeout(fallback); heroImg.classList.remove('is-pending'); };
    heroImg.onload = show;
    heroImg.onerror = show;
    heroImg.alt = hero.name;
    heroImg.src = img(hero.images[0], 1080);
    const link = $('#hero-feature');
    link.innerHTML = `<span>En portada</span><b>${esc(hero.name)}</b>`;
    link.href = `/shop.html?p=${encodeURIComponent(hero.id)}`;
    link.hidden = false;
    link.addEventListener('click', e => { e.preventDefault(); openProduct(hero); });
  }

  const grips = products.filter(p => p.type === 'grip');
  const picks = [...grips.filter(p => p.featured), ...grips.filter(p => !p.featured)].slice(0, 8);
  grid.innerHTML = picks.map(cardHTML).join('');
  bindCards(grid, picks);
  initReveal(grid);
}).catch(() => heroImg.classList.remove('is-pending'));
