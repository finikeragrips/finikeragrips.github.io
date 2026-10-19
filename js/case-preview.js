// 2D schematic renderer for the case studio. Pure function: (design, options, view) → SVG markup.
import { esc } from './site.js';

const byId = (list, id) => (list || []).find(o => o.id === id) || {};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, '0')).join('');
}

const PISTOL = 'M0 12 L270 12 Q276 12 276 18 L276 50 Q276 56 270 56 L132 56 Q122 58 118 68 L112 84 Q106 96 92 92 L84 88 Q78 86 78 94 L70 150 Q68 160 58 160 L26 160 Q16 160 18 150 L34 60 Q34 56 28 56 L6 56 Q0 56 0 50 Z';

function defs(d, o) {
  const ext = byId(o.exteriorColors, d.exterior).hex || '#333';
  const lin = byId(o.linings, d.lining).hex || '#5a1222';
  const hw = byId(o.hardware, d.hardware).hex || '#c2a061';
  return { ext, lin, hw, svg: `
  <defs>
    <linearGradient id="g-ext" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(ext, d.material === 'lacquer' ? .16 : .08)}"/>
      <stop offset=".55" stop-color="${ext}"/>
      <stop offset="1" stop-color="${shade(ext, -.28)}"/>
    </linearGradient>
    <linearGradient id="g-sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".14"/>
      <stop offset=".55" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="g-hw" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(hw, .45)}"/><stop offset=".5" stop-color="${hw}"/><stop offset="1" stop-color="${shade(hw, -.35)}"/>
    </linearGradient>
    <radialGradient id="g-lin" cx=".5" cy=".4" r=".8">
      <stop offset="0" stop-color="${shade(lin, .12)}"/><stop offset="1" stop-color="${shade(lin, -.35)}"/>
    </radialGradient>
    <filter id="f-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.11" numOctaves="3" seed="11"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.6 0 0 0 -0.62"/>
    </filter>
    <filter id="f-velvet" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 -.18"/>
    </filter>
    <filter id="f-emboss"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="f-inset"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>` };
}

function finish(d, x, y, w, h, r) {
  const grain = d.material === 'wood'
    ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" filter="url(#f-grain)" opacity=".55"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#g-sheen)"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#g-ext)"/>${grain}`;
}

function filigree(cx, cy, w, h, color) {
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  const corner = (x, y, sx, sy) => `<path d="M${x} ${y + sy * 46} Q${x} ${y} ${x + sx * 46} ${y} M${x + sx * 12} ${y + sy * 30} q${sx * 6} ${-sy * 18} ${sx * 22} ${-sy * 18} M${x + sx * 20} ${y + sy * 20} m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0"/>`;
  return `<g fill="none" stroke="${color}" stroke-width="1.6" opacity=".95">
    <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="6" stroke-dasharray="1 5" stroke-linecap="round"/>
    ${corner(x0 + 8, y0 + 8, 1, 1)}${corner(x1 - 8, y0 + 8, -1, 1)}${corner(x0 + 8, y1 - 8, 1, -1)}${corner(x1 - 8, y1 - 8, -1, -1)}
    <path d="M${cx - 60} ${y0 + 14} q30 -10 60 0 q30 10 60 0 M${cx - 60} ${y1 - 14} q30 10 60 0 q30 -10 60 0"/></g>`;
}

function emblem(d, cx, cy, ext) {
  const light = shade(ext, .22), dark = shade(ext, -.4);
  if (d.emblem === 'horse') return `<g text-anchor="middle" font-family="'Cormorant Garamond',serif">
      <text x="${cx + 1.5}" y="${cy + 30}" font-size="92" fill="${dark}" filter="url(#f-emboss)">♞</text>
      <text x="${cx}" y="${cy + 28}" font-size="92" fill="${light}" opacity=".85">♞</text></g>`;
  if (d.emblem === 'medallion') return `<g fill="none"><ellipse cx="${cx}" cy="${cy}" rx="56" ry="70" stroke="${dark}" stroke-width="6" filter="url(#f-emboss)"/>
      <ellipse cx="${cx}" cy="${cy}" rx="56" ry="70" stroke="${light}" stroke-width="2"/><ellipse cx="${cx}" cy="${cy}" rx="44" ry="58" stroke="${light}" stroke-width="1" opacity=".6"/></g>`;
  return '';
}

function artPanel(d, cx, cy, w, h, refImg, hw) {
  if (d.artwork === 'none') return '';
  if (d.artwork === 'filigree') return filigree(cx, cy, w, h, hw);
  const img = refImg ? `<clipPath id="clip-art-${cx}"><ellipse cx="${cx}" cy="${cy}" rx="${w / 4.2}" ry="${h / 2.6}"/></clipPath>
      <image href="${esc(refImg)}" x="${cx - w / 4.2}" y="${cy - h / 2.6}" width="${w / 2.1}" height="${h / 1.3}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-art-${cx})" opacity=".9"/>` : '';
  return `<g>${img}<ellipse cx="${cx}" cy="${cy}" rx="${w / 4.2}" ry="${h / 2.6}" fill="${refImg ? 'none' : 'rgba(255,255,255,.06)'}" stroke="${hw}" stroke-width="2"/>
    ${refImg ? '' : `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Manrope,sans-serif" font-size="12" letter-spacing="3" fill="${hw}">ARTE A MANO</text>`}</g>`;
}

function lettering(d, o, cx, y, hw) {
  const font = byId(o.textFonts, d.font).css || 'serif';
  const parts = [];
  if (d.monogram) parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${esc(font)}" font-size="${d.font === 'script' ? 44 : 34}" letter-spacing="${d.font === 'script' ? 2 : 10}" fill="url(#g-hw)">${esc(d.monogram)}</text>`);
  if (d.text) parts.push(`<text x="${cx}" y="${y + (d.monogram ? 34 : 0)}" text-anchor="middle" font-family="${esc(font)}" font-size="${d.font === 'script' ? 28 : 17}" letter-spacing="${d.font === 'block' ? 4 : 1.5}" fill="url(#g-hw)">${esc(d.font === 'block' ? d.text.toUpperCase() : d.text)}</text>`);
  return parts.join('');
}

function corners(x, y, w, h) {
  const c = (cx, cy, sx, sy) => `<path d="M${cx} ${cy} h${sx * 30} v${sy * 7} h${-sx * 23} v${sy * 23} h${-sx * 7} Z" fill="url(#g-hw)"/>`;
  return c(x, y, 1, 1) + c(x + w, y, -1, 1) + c(x, y + h, 1, -1) + c(x + w, y + h, -1, -1);
}

export function renderCase(d, o, view = 'closed', refImg = null) {
  const { ext, lin, hw, svg } = defs(d, o);
  const outside = d.placement !== 'lid-inside';
  const inside = d.placement !== 'lid-outside';
  if (view === 'open') {
    const foam = d.foam;
    const cut = shade(lin, -.45);
    const pistol = `<g transform="translate(232 352)"><path d="${PISTOL}" fill="${cut}"/><path d="${PISTOL}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="5" filter="url(#f-inset)"/></g>`;
    const mags = [0, 1].map(i => `<rect x="${560 + i * 44}" y="338" width="30" height="128" rx="5" fill="${cut}"/>`).join('');
    const grips = `<rect x="120" y="344" width="78" height="120" rx="6" fill="${cut}"/><text x="159" y="480" text-anchor="middle" font-size="9" letter-spacing="2" fill="${shade(lin, .35)}" font-family="Manrope">CACHAS</text>`;
    const quilt = Array.from({ length: 9 }, (_, i) => `<path d="M${130 + i * 62} 330 v148" stroke="${shade(lin, -.18)}" stroke-width="1"/>`).join('');
    const base = foam === 'flat' ? quilt : pistol + mags + (foam === 'fitted-grips' ? grips : '');
    return `<svg viewBox="0 0 800 560" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Estuche abierto">${svg}
      ${finish(d, 80, 30, 640, 250, 14)}
      <rect x="104" y="52" width="592" height="210" rx="6" fill="url(#g-lin)"/><rect x="104" y="52" width="592" height="210" rx="6" filter="url(#f-velvet)" fill="#000"/>
      ${inside ? artPanel(d, 400, 157, 380, 170, refImg, hw) : ''}
      ${!inside || d.artwork === 'none' || d.artwork === 'filigree' ? lettering(d, o, 400, d.artwork === 'filigree' ? 168 : 160, hw) : ''}
      <rect x="180" y="276" width="56" height="12" rx="3" fill="url(#g-hw)"/><rect x="564" y="276" width="56" height="12" rx="3" fill="url(#g-hw)"/>
      ${finish(d, 80, 290, 640, 230, 14)}
      <rect x="104" y="310" width="592" height="190" rx="6" fill="url(#g-lin)"/><rect x="104" y="310" width="592" height="190" rx="6" filter="url(#f-velvet)" fill="#000"/>
      ${base}
      <rect x="370" y="508" width="60" height="14" rx="3" fill="url(#g-hw)"/>
    </svg>`;
  }
  const art = outside ? artPanel(d, 400, 250, 520, 290, refImg, hw) : '';
  const hasPortrait = outside && (d.artwork === 'portrait' || d.artwork === 'freeform');
  return `<svg viewBox="0 0 800 560" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Estuche cerrado">${svg}
    <rect x="86" y="438" width="628" height="54" rx="12" fill="${shade(ext, -.5)}"/>
    ${finish(d, 80, 70, 640, 380, 16)}
    <rect x="104" y="94" width="592" height="332" rx="8" fill="none" stroke="${shade(ext, -.45)}" stroke-width="3"/>
    <rect x="106" y="96" width="588" height="328" rx="7" fill="none" stroke="${shade(ext, .25)}" stroke-opacity=".35" stroke-width="1"/>
    ${art}
    ${hasPortrait ? '' : emblem(d, 400, d.monogram || d.text ? 220 : 250, ext)}
    ${lettering(d, o, 400, hasPortrait ? 400 : (d.emblem === 'none' ? 262 : 340), hw)}
    ${corners(80, 70, 640, 380)}
    <rect x="372" y="440" width="56" height="30" rx="4" fill="url(#g-hw)"/><circle cx="400" cy="455" r="4" fill="${shade(hw, -.5)}"/>
  </svg>`;
}
