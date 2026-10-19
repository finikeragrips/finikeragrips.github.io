import { initLayout, loadCatalog, initReveal, $ } from './site.js';
import { cardHTML, bindCards } from './products.js';

initLayout();
const grid = $('#featured');
loadCatalog().then(({ products }) => {
  const grips = products.filter(p => p.type === 'grip');
  const picks = [...grips.filter(p => p.featured), ...grips.filter(p => !p.featured)].slice(0, 8);
  grid.innerHTML = picks.map(cardHTML).join('');
  bindCards(grid, picks);
  initReveal(grid);
});
