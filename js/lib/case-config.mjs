// Shared by the browser studio and the server API: one source of truth for
// validating a case design and computing its price estimate.

const byId = (list, id) => (list || []).find(o => o.id === id) || null;
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export const DEFAULT_DESIGN = {
  model: 'case-1911', material: 'wood', exterior: 'walnut', hardware: 'gold',
  lining: 'burgundy', foam: 'fitted', emblem: 'horse',
  artwork: 'none', placement: 'lid-outside', artworkNotes: '',
  monogram: '', text: '', font: 'roman', notes: ''
};

export function colorsFor(options, material) {
  return options.exteriorColors.filter(c => !c.materials || c.materials.includes(material));
}

// Returns { design, errors } — the design contains only known ids and cleaned text.
export function normalizeDesign(input = {}, options) {
  const lim = options.limits || {};
  const errors = [];
  const d = {};
  const pick = (key, list, label) => {
    const val = input[key] ?? DEFAULT_DESIGN[key];
    const opt = byId(list, val);
    if (!opt || opt.available === false) errors.push(`${label}: opción no válida`);
    d[key] = opt ? opt.id : null;
  };
  pick('model', options.models, 'Modelo');
  pick('material', options.materials, 'Material');
  pick('exterior', options.exteriorColors, 'Color exterior');
  pick('hardware', options.hardware, 'Herrajes');
  pick('lining', options.linings, 'Forro');
  pick('foam', options.foam, 'Interior');
  pick('emblem', options.lidEmblems, 'Emblema');
  pick('artwork', options.artwork, 'Pintura');
  pick('placement', options.artworkPlacements, 'Ubicación del arte');
  pick('font', options.textFonts, 'Tipografía');

  const ext = byId(options.exteriorColors, d.exterior);
  if (ext && ext.materials && !ext.materials.includes(d.material)) errors.push('El color exterior no está disponible en ese material');

  d.monogram = clean(input.monogram, lim.monogram || 3).toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ&]/g, '');
  d.text = clean(input.text, lim.text || 28);
  d.artworkNotes = clean(input.artworkNotes, 600);
  d.notes = clean(input.notes, lim.notes || 1500);
  if (d.artwork && d.artwork !== 'none' && !d.artworkNotes && !input._hasUploads) {
    errors.push('Describe el arte deseado o sube una imagen de referencia');
  }
  return { design: d, errors };
}

// Estimate only when every selected element has a defined price and nothing is quote-only.
export function estimate(d, options) {
  const lines = [];
  const reasons = [];
  const add = (label, opt) => {
    if (!opt) return;
    if (opt.quote) reasons.push(`${label}: ${opt.label} se cotiza de forma individual`);
    else if (typeof opt.price !== 'number') reasons.push(`${label}: ${opt.label} sin precio publicado`);
    else if (opt.price) lines.push({ label: `${label}: ${opt.label}`, amount: opt.price });
  };
  const model = byId(options.models, d.model);
  if (model && typeof model.price === 'number') lines.unshift({ label: model.label, amount: model.price });
  else reasons.push('Precio base del modelo no publicado');
  add('Material', byId(options.materials, d.material));
  add('Exterior', byId(options.exteriorColors, d.exterior));
  add('Herrajes', byId(options.hardware, d.hardware));
  add('Forro', byId(options.linings, d.lining));
  add('Interior', byId(options.foam, d.foam));
  add('Emblema', byId(options.lidEmblems, d.emblem));
  add('Pintura', byId(options.artwork, d.artwork));
  if (d.monogram || d.text) {
    if (typeof options.textPrice === 'number') { if (options.textPrice) lines.push({ label: 'Personalización de texto', amount: options.textPrice }); }
    else reasons.push('Personalización de texto sin precio publicado');
  }
  if (reasons.length) return { status: 'quote', total: null, lines, reasons };
  return { status: 'estimate', total: lines.reduce((s, l) => s + l.amount, 0), lines, reasons };
}

export function describe(d, options) {
  const L = (list, id) => (byId(list, id) || {}).label || '—';
  const rows = [
    ['Modelo', L(options.models, d.model)],
    ['Material', L(options.materials, d.material)],
    ['Exterior', L(options.exteriorColors, d.exterior)],
    ['Herrajes', L(options.hardware, d.hardware)],
    ['Emblema de tapa', L(options.lidEmblems, d.emblem)],
    ['Forro interior', L(options.linings, d.lining)],
    ['Configuración interior', L(options.foam, d.foam)],
    ['Pintura a mano', L(options.artwork, d.artwork)]
  ];
  if (d.artwork !== 'none') rows.push(['Ubicación del arte', L(options.artworkPlacements, d.placement)]);
  if (d.artworkNotes) rows.push(['Descripción del arte', d.artworkNotes]);
  if (d.monogram) rows.push(['Monograma', d.monogram]);
  if (d.text) rows.push(['Texto', d.text]);
  if (d.monogram || d.text) rows.push(['Tipografía', L(options.textFonts, d.font)]);
  if (d.notes) rows.push(['Notas para el artista', d.notes]);
  return rows;
}

export function money(n, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}
