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

  // Featured: 5 grips and 3 cases, with a case in every row.
  const ranked = type => {
    const list = products.filter(p => p.type === type);
    return [...list.filter(p => p.featured), ...list.filter(p => !p.featured)];
  };
  const grips = ranked('grip').slice(0, 5);
  const cases = ranked('case').slice(0, 3);
  const picks = [...grips];
  [1, 4, 7].forEach((at, i) => cases[i] && picks.splice(Math.min(at, picks.length), 0, cases[i]));
  grid.innerHTML = picks.map(cardHTML).join('');
  bindCards(grid, picks);
  initReveal(grid);
}).catch(() => heroImg.classList.remove('is-pending'));
