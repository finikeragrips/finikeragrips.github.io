import { initLayout, $, esc, money, session, toast, IG_DM } from './site.js';

initLayout();
const o = session.get('fg-last-order');
const box = $('#receipt');
const ref = new URLSearchParams(location.search).get('ref');

if (!o || (ref && o.ref !== ref)) {
  box.innerHTML = `<p class="eyebrow">Pedido</p><h1 class="h2">Referencia ${esc(ref || '')}</h1>
    <p class="lead">Guarda tu número de referencia. Si necesitas ayuda, escríbenos por Instagram indicando este número.</p>
    <a class="btn" href="${IG_DM}" target="_blank" rel="noopener">Escribir por Instagram</a>`;
} else {
  const quote = o.requestType === 'quote';
  const rows = (o.summary || []).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const est = o.estimate && o.estimate.status === 'estimate' && typeof o.estimate.total === 'number' ? money(o.estimate.total) : null;
  const dmText = `Hola Finikera Grips, soy ${o.customerName}. Mi ${quote ? 'solicitud de cotización' : 'pedido'} es ${o.ref}:\n` +
    (o.summary || []).map(([k, v]) => `• ${k}: ${v}`).join('\n') + (o.files ? `\n(Te envío ${o.files} imagen(es) de referencia por aquí.)` : '');
  box.innerHTML = `
    <p class="eyebrow">${quote ? 'Solicitud de cotización' : 'Pedido'} ${o.offline ? 'preparado' : 'recibido'}</p>
    <h1 class="h2">Gracias, ${esc(o.customerName.split(' ')[0])}.</h1>
    <p class="tiny" style="margin-top:28px">Tu número de referencia</p>
    <p class="ref">${esc(o.ref)}</p>
    ${o.offline
      ? `<div class="notice" style="margin:24px 0">Para completar tu ${quote ? 'solicitud' : 'pedido'}, envíanos este resumen por Instagram${o.files ? ' junto con tus imágenes de referencia' : ''}. Lo copiamos por ti.</div>
         <div class="hero__actions no-print"><button class="btn" id="dm">Copiar y abrir Instagram</button></div>`
      : `<p class="lead" style="margin-top:20px">${quote
          ? 'Revisaremos tu diseño y te enviará una cotización y, si aplica, un boceto en 1–2 días hábiles.'
          : 'Confirmaremos disponibilidad y te enviaremos los datos de pago (Zelle o Apple Pay). No se ha realizado ningún cargo.'}
         Te contactaremos por el medio que elegiste.</p>`}
    <h2 class="h3" style="margin-top:40px">Resumen</h2>
    <table class="summary">${rows}${est ? `<tr><th scope="row">Precio estimado</th><td>${est} + envío</td></tr>` : `<tr><th scope="row">Precio</th><td>${quote ? 'Por cotizar' : 'A confirmar'}</td></tr>`}</table>
    <div class="hero__actions no-print" style="margin-top:32px">
      <button class="btn btn--ghost" id="print">Imprimir / guardar PDF</button>
      <a class="btn btn--ghost" href="/">Volver al inicio</a>
    </div>`;
  $('#print').addEventListener('click', () => print());
  $('#dm')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(dmText); toast('Resumen copiado. Pégalo en el chat.'); } catch {}
    open(IG_DM, '_blank', 'noopener');
  });
}
