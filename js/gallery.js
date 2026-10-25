import { initLayout, $, $$, esc, img, lightbox, initReveal } from './site.js';

initLayout();
const { items } = await (await fetch('/data/gallery.json')).json();
let list = items;

function render(cat) {
  list = cat ? items.filter(i => i.category === cat) : items;
  $('#masonry').innerHTML = list.map((it, i) => `
    <figure class="reveal" tabindex="0" data-i="${i}"><img src="${esc(img(it.src))}" alt="${esc(it.caption)}" loading="lazy" decoding="async" /><figcaption>${esc(it.caption)}</figcaption></figure>`).join('');
  initReveal($('#masonry'));
}
const openAt = el => lightbox(list.map(i => i.src), +el.dataset.i, list.map(i => i.caption));
$('#masonry').addEventListener('click', e => { const f = e.target.closest('figure'); if (f) openAt(f); });
$('#masonry').addEventListener('keydown', e => { const f = e.target.closest('figure'); if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAt(f); } });
$('#gal-filter').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  $$('[data-cat]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render(b.dataset.cat);
});
render('');
