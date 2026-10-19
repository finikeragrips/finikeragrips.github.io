import { initLayout, cartLines, cart, $, esc, src, money, MODELS } from './site.js';
import { customerFieldsHTML, readCustomer, submitOrder, showErrors } from './order-form.js';

initLayout();
$('#customer-fields').innerHTML = customerFieldsHTML();
const lines = await cartLines();

if (!lines.length) {
  $('#checkout-form').innerHTML = `<div class="empty"><p class="h3">Tu pedido está vacío</p><a class="btn" href="/shop.html">Ver cachas</a></div>`;
} else {
  $('#lines').innerHTML = lines.map(l => `
    <div class="line"><img src="${esc(src(l.product.images[0]))}" alt="" />
      <div><div class="line__name">${esc(l.product.name)}</div><div class="small muted">${esc(MODELS[l.product.model] || '')}${l.variant ? ' · ' + esc(l.variant.label) : ''} · Cant. ${l.qty}</div></div>
      <div class="small">${l.unit === null ? 'A consultar' : money(l.unit * l.qty)}</div></div>`).join('');
  const priced = lines.every(l => l.unit !== null);
  const total = lines.reduce((s, l) => s + (l.unit || 0) * l.qty, 0);
  $('#totals').innerHTML = `<div class="estimate__total"><span class="tiny">${priced ? 'Subtotal' : 'Precio'}</span><b>${priced ? money(total) : 'A confirmar'}</b></div>
    <span class="small muted">${priced ? 'Envío se confirma con tu pedido.' : 'Algunas piezas no tienen precio publicado; te enviaremos el total antes de cualquier pago.'}</span>`;
  $('#submit-btn').textContent = priced ? 'Enviar pedido' : 'Solicitar precio y disponibilidad';
}

$('#checkout-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const { customer, consent, errors } = readCustomer(form);
  if (errors.length) return showErrors(form, errors);
  const btn = $('#submit-btn');
  btn.disabled = true; btn.textContent = 'Enviando…';
  const items = lines.map(l => ({ id: l.product.id, variant: l.variant ? l.variant.id : null, qty: l.qty }));
  const priced = lines.every(l => l.unit !== null);
  const total = lines.reduce((s, l) => s + (l.unit || 0) * l.qty, 0);
  const ok = await submitOrder({
    payload: { kind: 'cart', items, customer, consent, notes: form.notes.value.trim() },
    website: form.website.value,
    offlineSummary: () => lines.map(l => [`${l.qty} × ${l.product.name}${l.variant ? ' — ' + l.variant.label : ''}`, l.unit === null ? 'Precio a confirmar' : money(l.unit * l.qty)]),
    offlineEstimate: () => ({ status: priced ? 'estimate' : 'quote', total: priced ? total : null })
  }, form);
  if (ok) cart.clear();
  else btn.disabled = false;
});
