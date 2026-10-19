// Custom case studio: step-by-step configurator, live preview, uploads and submission.
import { initLayout, loadOptions, $, $$, esc, src, money, lightbox, toast } from './site.js';
import { DEFAULT_DESIGN, colorsFor, normalizeDesign, estimate, describe } from './lib/case-config.mjs';
import { renderCase } from './case-preview.js';
import { compressImage } from './upload.js';
import { customerFieldsHTML, readCustomer, submitOrder, showErrors } from './order-form.js';

initLayout();
const O = await loadOptions();
const DRAFT_KEY = 'fg-case-draft-v1';
let d = { ...DEFAULT_DESIGN };
try { Object.assign(d, JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}); } catch {}
d = normalizeDesign({ ...d, _hasUploads: true }, O).design;
for (const k of Object.keys(DEFAULT_DESIGN)) if (d[k] === null) d[k] = DEFAULT_DESIGN[k];
let view = 'closed';
let files = []; // { blob, url, name }
let current = 0;
const visited = new Set([0]);
const L = (list, id) => (list.find(o => o.id === id) || {}).label || '—';
const tag = o => (o.quote ? '<span class="tag">Cotización</span>' : '');

// ── Step definitions ───────────────────────────────────────────────────────
const optButtons = (key, list, extra = () => '') => `<div class="opts" role="radiogroup">${list.filter(o => o.available !== false).map(o => `
  <button type="button" class="opt" role="radio" data-set="${key}" data-val="${esc(o.id)}" aria-checked="${d[key] === o.id}">
    ${tag(o)}<b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}${extra(o)}</button>`).join('')}</div>`;
const swatches = (key, list) => `<div class="swatches" role="radiogroup">${list.filter(o => o.available !== false).map(o => `
  <button type="button" class="sw" role="radio" data-set="${key}" data-val="${esc(o.id)}" aria-checked="${d[key] === o.id}" aria-label="${esc(o.label)}" title="${esc(o.label)}" style="background:${esc(o.hex)}"></button>`).join('')}</div>
  <div class="sw-label">${esc(L(list, d[key]))}${list.find(o => o.id === d[key])?.quote ? ' · se cotiza' : ''}</div>`;
const group = (label, body) => `<div class="opt-group"><span class="label">${label}</span>${body}</div>`;
const next = i => i < STEPS.length - 1 ? `<div><button type="button" class="btn btn--ghost btn--sm" data-goto="${i + 1}">Siguiente: ${STEPS[i + 1].title}</button></div>` : '';

const STEPS = [
  { title: 'Modelo', value: () => L(O.models, d.model), body: () => `<div class="opts" role="radiogroup" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${O.models.filter(m => m.available !== false).map(m => `
      <button type="button" class="opt opt--model" role="radio" data-set="model" data-val="${esc(m.id)}" aria-checked="${d.model === m.id}">
        <img src="${esc(src(m.photo))}" alt="" loading="lazy" /><div><b>${esc(m.label)}</b><small>${esc(m.desc)}</small><small>${esc(m.dims || '')}</small></div></button>`).join('')}</div>` },
  { title: 'Exterior', value: () => `${L(O.materials, d.material)} · ${L(O.exteriorColors, d.exterior)}`, body: () =>
      group('Material', optButtons('material', O.materials)) +
      group('Color', swatches('exterior', colorsFor(O, d.material))) +
      group('Herrajes', swatches('hardware', O.hardware)) +
      group('Emblema de la tapa', optButtons('emblem', O.lidEmblems)) },
  { title: 'Interior', value: () => `${L(O.linings, d.lining)} · ${L(O.foam, d.foam)}`, body: () =>
      group('Forro', swatches('lining', O.linings)) + group('Configuración', optButtons('foam', O.foam)) },
  { title: 'Arte a mano', value: () => L(O.artwork, d.artwork), body: () =>
      group('Pintura decorativa', optButtons('artwork', O.artwork)) +
      (d.artwork !== 'none' ? group('Ubicación', optButtons('placement', O.artworkPlacements)) + `
      <div class="field"><label for="artworkNotes">Describe la obra</label><textarea id="artworkNotes" data-text="artworkNotes" maxlength="600" placeholder="Ej.: Virgen de Guadalupe con rosas, tonos dorados, estilo clásico.">${esc(d.artworkNotes)}</textarea>
      <span class="hint">Puedes subir imágenes de referencia en el siguiente paso.</span></div>
      <p class="notice">Cada pintura es única y la hace a mano nuestro artista. Te enviaremos una cotización y un boceto antes de empezar.</p>` : '') },
  { title: 'Personalización', value: () => [d.monogram, d.text].filter(Boolean).join(' · ') || (files.length ? `${files.length} imagen(es)` : 'Opcional'), body: () => `
      <div class="form-row">
        <div class="field"><label for="monogram">Monograma</label><input id="monogram" data-text="monogram" maxlength="${O.limits.monogram}" value="${esc(d.monogram)}" placeholder="Ej.: JMR" autocomplete="off" /><span class="hint">Hasta ${O.limits.monogram} letras</span></div>
        <div class="field"><label for="text">Nombre o frase</label><input id="text" data-text="text" maxlength="${O.limits.text}" value="${esc(d.text)}" placeholder="Ej.: Familia Ramírez" autocomplete="off" /></div>
      </div>
      ${group('Tipografía', `<div class="opts" role="radiogroup">${O.textFonts.map(f => `<button type="button" class="opt" role="radio" data-set="font" data-val="${esc(f.id)}" aria-checked="${d.font === f.id}"><b style="font-family:${esc(f.css)};font-size:${f.id === 'script' ? 22 : 17}px;font-weight:400">${esc(d.monogram || 'Aa')}</b><small>${esc(f.label)}</small></button>`).join('')}</div>`)}
      ${group('Imágenes de referencia o logotipo', `
        <label class="drop" id="drop"><input type="file" id="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden />
          Arrastra o <u>elige imágenes</u> · JPG, PNG o WebP · máx. ${O.limits.uploads}</label>
        <div class="thumbs" id="thumbs"></div>
        <span class="hint small muted">Solo para diseño decorativo. Sube imágenes de las que tengas derecho de uso.</span>`)}
      <div class="field"><label for="notes">Notas para el artista</label><textarea id="notes" data-text="notes" maxlength="${O.limits.notes}" placeholder="Fechas, significado del diseño, colores preferidos…">${esc(d.notes)}</textarea></div>` },
  { title: 'Revisión y envío', value: () => (estimate(d, O).status === 'estimate' ? 'Pedido' : 'Cotización'), body: () => `
      <table class="summary" id="summary"></table>
      <div class="estimate" id="estimate"></div>
      <form class="form" id="order-form" novalidate>
        <div id="form-errors"></div>
        ${customerFieldsHTML()}
        <button class="btn btn--block" type="submit" id="submit-btn">Enviar</button>
        <p class="small muted" style="margin:0">No se cobra nada al enviar. Revisamos tu diseño y te contactamos para confirmar detalles, precio final y tiempo de entrega.</p>
      </form>` }
];

// ── Render ─────────────────────────────────────────────────────────────────
function renderSteps() {
  $('#steps').innerHTML = STEPS.map((s, i) => `
    <div class="step-panel ${i === current ? 'open' : ''}" data-step="${i}">
      <button type="button" data-toggle="${i}" aria-expanded="${i === current}" aria-controls="step-body-${i}">
        <span class="num">0${i + 1}</span><span class="ttl">${s.title}</span><span class="val" data-val-for="${i}">${esc(s.value())}</span>
      </button>
      <div class="step-body" id="step-body-${i}">${i === current ? s.body() + next(i) : ''}</div>
    </div>`).join('');
  $('#progress').innerHTML = STEPS.map((_, i) => `<span class="${visited.has(i) ? 'done' : ''}"></span>`).join('');
  if (current === 4) renderThumbs();
  if (current === STEPS.length - 1) renderReview();
}

function refreshValues() {
  STEPS.forEach((s, i) => { const el = $(`[data-val-for="${i}"]`); if (el) el.textContent = s.value(); });
}

function renderPreview() {
  $('#preview').innerHTML = renderCase(d, O, view, files[0]?.url);
  const ext = O.exteriorColors.find(c => c.id === d.exterior) || {};
  const lin = O.linings.find(c => c.id === d.lining) || {};
  const model = O.models.find(m => m.id === d.model) || {};
  const photos = [...new Set([...(ext.photos || []), ...(lin.photos || []), model.photo].filter(Boolean))];
  $('#refs').innerHTML = photos.map((p, i) => `<button type="button" data-ref="${i}" aria-label="Ver foto real ${i + 1}"><img src="${esc(src(p))}" alt="" loading="lazy" /></button>`).join('');
  $('#refs').onclick = e => { const b = e.target.closest('[data-ref]'); if (b) lightbox(photos, +b.dataset.ref); };
  const est = estimate(d, O);
  $('#mobile-price').textContent = est.status === 'estimate' ? money(est.total) : 'Cotización';
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}

function renderReview() {
  const rows = describe(d, O);
  if (files.length) rows.push(['Imágenes de referencia', `${files.length} adjunta(s)`]);
  $('#summary').innerHTML = rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const est = estimate(d, O);
  $('#estimate').innerHTML = est.status === 'estimate'
    ? `<div class="estimate__total"><span class="tiny">Precio estimado</span><b>${money(est.total)}</b></div>
       <span class="small muted">Más envío. Confirmamos el precio final antes de cobrar.</span>`
    : `<div class="estimate__total"><span class="tiny">Precio</span><b>Cotización</b></div>
       <span class="small muted">Este diseño incluye elementos que cotizamos de forma individual. Recibirás tu precio en 1–2 días hábiles.</span>
       <details class="small muted"><summary>¿Por qué?</summary><ul>${est.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>`;
  $('#submit-btn').textContent = est.status === 'estimate' ? 'Enviar pedido' : 'Solicitar cotización';
}

function renderThumbs() {
  const box = $('#thumbs');
  if (!box) return;
  box.innerHTML = files.map((f, i) => `<div class="thumb"><img src="${f.url}" alt="${esc(f.name)}" /><button type="button" data-rm="${i}" aria-label="Quitar ${esc(f.name)}">×</button></div>`).join('');
}

function open(i) {
  current = i;
  visited.add(i);
  renderSteps();
  const panel = $(`[data-step="${i}"]`);
  if (panel && (panel.getBoundingClientRect().top < 0 || innerWidth < 980)) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// ── Events ─────────────────────────────────────────────────────────────────
$('#steps').addEventListener('click', e => {
  const t = e.target.closest('[data-toggle]');
  if (t) { const i = +t.dataset.toggle; i === current ? (current = -1, renderSteps()) : open(i); return; }
  const g = e.target.closest('[data-goto]');
  if (g) { open(+g.dataset.goto); return; }
  const s = e.target.closest('[data-set]');
  if (s) {
    d[s.dataset.set] = s.dataset.val;
    if (s.dataset.set === 'material') {
      const ok = colorsFor(O, d.material);
      if (!ok.some(c => c.id === d.exterior)) d.exterior = ok[0].id;
      if (d.material === 'wood' && d.emblem === 'none') d.emblem = 'horse';
    }
    if (s.dataset.set === 'lining' || s.dataset.set === 'foam') view = 'open';
    if (['exterior', 'material', 'emblem', 'hardware'].includes(s.dataset.set)) view = 'closed';
    if (s.dataset.set === 'placement') view = d.placement === 'lid-inside' ? 'open' : 'closed';
    syncView();
    renderSteps();
    renderPreview();
    return;
  }
  const rm = e.target.closest('[data-rm]');
  if (rm) { URL.revokeObjectURL(files[+rm.dataset.rm].url); files.splice(+rm.dataset.rm, 1); renderThumbs(); renderPreview(); refreshValues(); }
});

$('#steps').addEventListener('input', e => {
  const k = e.target.dataset.text;
  if (!k) return;
  d[k] = e.target.value;
  if (k === 'monogram') d.monogram = e.target.value = e.target.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ&]/g, '');
  renderPreview();
  refreshValues();
});

async function addFiles(list) {
  for (const f of list) {
    if (files.length >= O.limits.uploads) { toast(`Máximo ${O.limits.uploads} imágenes`); break; }
    try {
      const blob = await compressImage(f, O.limits.uploadBytes);
      files.push({ blob, url: URL.createObjectURL(blob), name: f.name });
    } catch (err) { toast(err.message); }
  }
  renderThumbs();
  renderPreview();
  refreshValues();
}
$('#steps').addEventListener('change', e => { if (e.target.id === 'file') { addFiles([...e.target.files]); e.target.value = ''; } });
$('#steps').addEventListener('dragover', e => { const z = e.target.closest('#drop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
$('#steps').addEventListener('dragleave', e => e.target.closest('#drop')?.classList.remove('over'));
$('#steps').addEventListener('drop', e => { const z = e.target.closest('#drop'); if (z) { e.preventDefault(); z.classList.remove('over'); addFiles([...e.dataTransfer.files]); } });

$('#steps').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const { design, errors } = normalizeDesign({ ...d, _hasUploads: files.length > 0 }, O);
  const { customer, consent, errors: cErr } = readCustomer(form);
  const all = [...errors, ...cErr];
  if (all.length) return showErrors(form, all);
  const btn = $('#submit-btn');
  btn.disabled = true; btn.textContent = 'Enviando…';
  const ok = await submitOrder({
    payload: { kind: 'custom-case', design, customer, consent },
    files: files.map((f, i) => new File([f.blob], `referencia-${i + 1}.jpg`, { type: f.blob.type })),
    website: form.website.value,
    offlineSummary: () => describe(design, O),
    offlineEstimate: () => estimate(design, O)
  }, form);
  if (ok) { try { localStorage.removeItem(DRAFT_KEY); } catch {} }
  else { btn.disabled = false; renderReview(); }
});

function syncView() {
  $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
}
$$('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; syncView(); renderPreview(); }));
$('#mobile-review').addEventListener('click', () => open(STEPS.length - 1));

renderSteps();
renderPreview();
