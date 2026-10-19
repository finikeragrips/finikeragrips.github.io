// Customer details form + order submission, shared by the case studio and checkout.
import { $, esc, session, IG_DM } from './site.js';

const STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','Puerto Rico'];
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export function customerFieldsHTML() {
  return `
    <div class="form-row">
      <div class="field"><label for="c-name">Nombre completo *</label><input id="c-name" name="name" autocomplete="name" required maxlength="80" /></div>
      <div class="field"><label for="c-email">Correo electrónico *</label><input id="c-email" name="email" type="email" autocomplete="email" required maxlength="254" /></div>
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
        <option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="email">Correo</option><option value="phone">Llamada</option></select></div>
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
  if (!EMAIL_RE.test(customer.email)) bad('email', 'Correo electrónico inválido');
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

// Posts to /api/orders. If the API is unreachable (e.g. the static GitHub Pages copy),
// falls back to an Instagram DM hand-off with the same reference and summary.
export async function submitOrder({ payload, files = [], website = '', offlineSummary, offlineEstimate }, form) {
  const fd = new FormData();
  fd.append('payload', JSON.stringify(payload));
  fd.append('website', website);
  files.forEach(f => fd.append('files', f));
  let res, data;
  try {
    res = await fetch('/api/orders', { method: 'POST', body: fd });
    data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  } catch { res = null; }

  if (res && data && (res.status === 201 || res.status === 200)) {
    session.set('fg-last-order', { ...data, kind: payload.kind, customerName: payload.customer.name, files: files.length });
    location.href = `/order.html?ref=${encodeURIComponent(data.ref)}`;
    return true;
  }
  if (res && data && res.status >= 400 && res.status < 500 && res.status !== 404 && res.status !== 405) {
    showErrors(form, data.errors || [data.error || 'No pudimos enviar tu pedido']);
    return false;
  }
  if (res && res.status >= 500) {
    showErrors(form, ['Nuestro sistema no respondió. Inténtalo de nuevo en unos minutos o escríbenos por Instagram.']);
    return false;
  }
  const est = offlineEstimate();
  session.set('fg-last-order', { ref: localRef(), offline: true, kind: payload.kind, customerName: payload.customer.name,
    summary: offlineSummary(), estimate: est, requestType: est.status === 'estimate' ? 'order' : 'quote', files: files.length, dm: IG_DM });
  location.href = '/order.html';
  return true;
}
