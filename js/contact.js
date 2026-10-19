import { initLayout, $, toast, IG_DM } from './site.js';

initLayout();
$('#msg-form').addEventListener('submit', async e => {
  e.preventDefault();
  const model = $('#m-model').value.trim(), text = $('#m-text').value.trim();
  if (!text) return $('#m-text').focus();
  const msg = `Hola Finikera Grips 👋${model ? `\nModelo: ${model}` : ''}\n${text}`;
  try { await navigator.clipboard.writeText(msg); toast('Mensaje copiado. Pégalo en el chat.'); } catch {}
  window.open(IG_DM, '_blank', 'noopener');
});
