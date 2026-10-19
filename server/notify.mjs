// Optional e-mail notifications through Resend (https://resend.com).
// Enabled only when RESEND_API_KEY, NOTIFY_EMAIL and FROM_EMAIL are set.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function notifyOrder(order, env = {}) {
  const { RESEND_API_KEY, NOTIFY_EMAIL, FROM_EMAIL } = env;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL || !FROM_EMAIL) return;
  const rows = order.summary.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
  const body = `<h2>${esc(order.ref)}</h2><table>${rows}</table>`;
  const send = (to, subject, html) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
  }).catch(() => {});
  await Promise.all([
    send(NOTIFY_EMAIL, `Nuevo pedido ${order.ref} (${order.kind})`, body),
    send(order.customer.email, `Finikera Grips — recibimos tu solicitud ${order.ref}`,
      `<p>Hola ${esc(order.customer.name)}, gracias por tu solicitud. Te contactaremos pronto.</p>${body}`)
  ]);
}
