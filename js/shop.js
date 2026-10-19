import { initLayout, loadCatalog, initReveal, $, esc, MODELS, COLORS } from './site.js';
import { cardHTML, bindCards, openProduct } from './products.js';

initLayout();

const TYPES = { grip: 'Cachas', case: 'Estuches' };
const state = { type: new Set(), model: new Set(), color: new Set(), q: '', sort: 'featured' };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const { products } = await loadCatalog();
products.forEach(p => { p._text = norm([p.name, p.description, p.finish, MODELS[p.model], (COLORS[p.color] || [])[0]].join(' ')); });

// URL → state
const params = new URLSearchParams(location.search);
['type', 'model', 'color'].forEach(k => (params.get(k) || '').split(',').filter(Boolean).forEach(v => state[k].add(v)));
state.q = params.get('q') || '';
state.sort = params.get('sort') || 'featured';
$('#q').value = state.q;
$('#sort').value = state.sort;

function matches(p, skip) {
  if (skip !== 'type' && state.type.size && !state.type.has(p.type)) return false;
  if (skip !== 'model' && state.model.size && !state.model.has(p.model)) return false;
  if (skip !== 'color' && state.color.size && !state.color.has(p.color)) return false;
  if (state.q) return norm(state.q).split(/\s+/).every(w => p._text.includes(w));
  return true;
}

function facet(key, labels, el) {
  const values = [...new Set(products.map(p => p[key]))].filter(v => v && !(key === 'model' && v === 'estuches'));
  el.innerHTML = values.map(v => {
    const n = products.filter(p => p[key] === v && matches(p, key)).length;
    const label = Array.isArray(labels[v]) ? labels[v][0] : labels[v] || v;
    const sw = key === 'color' && COLORS[v] ? `<span class="swatch" style="background:${COLORS[v][1]}"></span>` : '';
    return `<label class="check"><input type="checkbox" data-k="${key}" value="${esc(v)}" ${state[key].has(v) ? 'checked' : ''} />${sw}${esc(label)}<span class="count">${n}</span></label>`;
  }).join('');
}

function sortList(list) {
  const price = p => (typeof p.price === 'number' ? p.price : null);
  const byPrice = dir => (a, b) => (price(a) === null) - (price(b) === null) || dir * ((price(a) ?? 0) - (price(b) ?? 0));
  if (state.sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (state.sort === 'price-asc') return list.sort(byPrice(1));
  if (state.sort === 'price-desc') return list.sort(byPrice(-1));
  return list.sort((a, b) => (b.featured - a.featured));
}

function render() {
  facet('type', TYPES, $('#f-type'));
  facet('model', MODELS, $('#f-model'));
  facet('color', COLORS, $('#f-color'));
  const list = sortList(products.filter(p => matches(p)));
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'pieza' : 'piezas'}`;
  $('#grid').innerHTML = list.length ? list.map(cardHTML).join('') : `<div class="empty" style="grid-column:1/-1"><p class="h3">Sin resultados</p><p class="small">Prueba con otros filtros o <a class="link" href="/contact.html">pídenos un diseño especial</a>.</p></div>`;
  const chips = [];
  ['type', 'model', 'color'].forEach(k => state[k].forEach(v => {
    const lbl = { type: TYPES, model: MODELS, color: COLORS }[k][v];
    chips.push(`<button class="chip" data-k="${k}" data-v="${esc(v)}">${esc(Array.isArray(lbl) ? lbl[0] : lbl || v)} ✕</button>`);
  }));
  if (state.q) chips.push(`<button class="chip" data-k="q">“${esc(state.q)}” ✕</button>`);
  $('#active-chips').innerHTML = chips.join('');
  initReveal($('#grid'));
  syncUrl();
}

function syncUrl() {
  const u = new URL(location.href);
  ['type', 'model', 'color'].forEach(k => (state[k].size ? u.searchParams.set(k, [...state[k]].join(',')) : u.searchParams.delete(k)));
  state.q ? u.searchParams.set('q', state.q) : u.searchParams.delete('q');
  state.sort !== 'featured' ? u.searchParams.set('sort', state.sort) : u.searchParams.delete('sort');
  history.replaceState(null, '', u);
}

$('#filters').addEventListener('change', e => {
  const i = e.target;
  if (!i.dataset.k) return;
  i.checked ? state[i.dataset.k].add(i.value) : state[i.dataset.k].delete(i.value);
  render();
});
$('#active-chips').addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  if (c.dataset.k === 'q') { state.q = ''; $('#q').value = ''; } else state[c.dataset.k].delete(c.dataset.v);
  render();
});
let t;
$('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 160); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
$('#f-reset').addEventListener('click', () => { ['type', 'model', 'color'].forEach(k => state[k].clear()); state.q = ''; $('#q').value = ''; render(); });
const showFilters = open => { $('#filters').classList.toggle('open', open); document.body.style.overflow = open ? 'hidden' : ''; };
$('#filters-open').addEventListener('click', () => showFilters(true));
$('#filters-close').addEventListener('click', () => showFilters(false));
$('#filters-apply').addEventListener('click', () => showFilters(false));

bindCards($('#grid'), products);
render();
const deep = params.get('p') && products.find(p => p.id === params.get('p'));
if (deep) openProduct(deep);
