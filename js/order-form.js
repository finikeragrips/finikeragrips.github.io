// Customer details form + order submission, shared by the case studio and checkout.
import { esc, copyText, goToInstagram } from './site.js';

const STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','Puerto Rico'];
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export function customerFieldsHTML() {
  return `
    <div class="form-row">
      <div class="field"><label for="c-name">Nombre completo *</label><input id="c-name" name="name" autocomplete="name" required maxlength="80" /></div>
      <div class="field"><label for="c-email">Correo electrónico</label><input id="c-email" name="email" type="email" autocomplete="email" maxlength="254" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="c-phone">Teléfono / WhatsApp</label><input id="c-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" /></div>
      <div class="field"><label for="c-ig">Instagram</label><input id="c-ig" name="instagram" maxlength="31" placeholder="@usuario" autocomplete="off" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="c-state">Estado *</label><select id="c-state" name="state" required><option value="">Selecciona…</option>${STATES.map(s => `<option>${s}</option>`).join('')}</select></div>
      <div class="field"><label for="c-city">Ciudad</label><input id="c-city" name="city" autocomplete="address-level2" maxlength="60" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="c-contact">Prefiero que me contacten por</label><select id="c-contact" name="contactPref">
        <option value="instagram" selected>Instagram</option><option value="whatsapp">WhatsApp</option><option value="email">Correo</option><option value="phone">Llamada</option></select></div>
      <div class="field"><label for="c-pay">Forma de pago preferida</label><select id="c-pay" name="paymentPref">
        <option value="zelle">Zelle</option><option value="apple-pay">Apple Pay</option><option value="other">Otra (consultar)</option></select></div>
    </div>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <label class="consent"><input type="checkbox" name="consent" required /> <span>Confirmo que mis datos son correctos y acepto las <a class="link" href="/faq.html#politicas" target="_blank">políticas de pedidos personalizados</a>. Entiendo que estos accesorios son decorativos y que Finikera Grips no vende armas.</span></label>`;
}

export function readCustomer(form) {
  const v = n => (form.elements[n]?.value || '').trim();
  const customer = { name: v('name'), email: v('email'), phone: v('phone'), instagram: v('instagram').replace(/^@/, ''),
    state: v('state'), city: v('city'), contactPref: v('contactPref'), paymentPref: v('paymentPref') };
  const errors = [];
  const bad = (name, msg) => { errors.push(msg); form.elements[name]?.setAttribute('aria-invalid', 'true'); };
  [...form.querySelectorAll('[aria-invalid]')].forEach(el => el.removeAttribute('aria-invalid'));
  if (customer.name.length < 2) bad('name', 'Escribe tu nombre');
  if (customer.email && !EMAIL_RE.test(customer.email)) bad('email', 'Correo electrónico inválido');
  if (customer.phone && !/^[+\d\s().-]{7,30}$/.test(customer.phone)) bad('phone', 'Teléfono inválido');
  if (customer.instagram && !/^[\w.]{1,30}$/.test(customer.instagram)) bad('instagram', 'Usuario de Instagram inválido');
  if (!customer.state) bad('state', 'Selecciona tu estado');
  const consent = !!form.elements.consent?.checked;
  if (!consent) errors.push('Acepta las políticas para continuar');
  return { customer, consent, errors };
}

export function showErrors(form, errors) {
  const box = form.querySelector('#form-errors');
  box.innerHTML = `<div class="alert" role="alert">Revisa lo siguiente:<ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function localRef() {
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `FG-${d}-${Array.from(crypto.getRandomValues(new Uint8Array(5)), b => a[b % a.length]).join('')}`;
}

// Instagram hand-off: the order is saved on the server (when the API is available, so it shows up in
// the admin with its images) and the customer goes straight to the Instagram chat with the message
// already copied. The copy starts inside the click (before any await) so iOS Safari allows it.
export function dmText({ ref, name, summary, estimate, files = 0, quote }) {
  const total = estimate && estimate.status === 'estimate' && typeof estimate.total === 'number' ? `\nPrecio estimado: $${estimate.total} + envío` : '';
  return `Hola Finikera Grips 👋 Soy ${name}. ${quote ? 'Quiero cotizar' : 'Quiero pedir'} (ref. ${ref}):\n` +
    summary.map(([k, v]) => `• ${k}: ${v}`).join('\n') + total +
    (files ? `\n(Adjunté ${files} imagen(es) de referencia en la web.)` : '');
}

export async function submitOrder({ payload, files = [], website = '', summary, estimate }, form) {
  const ref = localRef();
  const est = estimate();
  const text = dmText({ ref, name: payload.customer.name, summary: summary(), estimate: est, files: files.length, quote: est.status !== 'estimate' });
  const copied = copyText(text);

  const fd = new FormData();
  fd.append('payload', JSON.stringify({ ...payload, ref }));
  fd.append('website', website);
  files.forEach(f => fd.append('files', f));
  let res = null, data = null;
  try {
    res = await fetch('/api/orders', { method: 'POST', body: fd });
    data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  } catch {}
  if (res && data && res.status === 422) {
    showErrors(form, data.errors || [data.error || 'Revisa tus datos']);
    return false;
  }
  if (res && data && res.status === 413) {
    showErrors(form, [data.error || 'Las imágenes son demasiado grandes']);
    return false;
  }
  // Saved, or the API is unavailable (static hosting / outage): the Instagram message still carries everything.
  await goToInstagram(text, copied);
  return true;
}
