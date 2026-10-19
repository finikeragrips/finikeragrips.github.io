import { timingSafeEqual, createHash } from 'node:crypto';

const SECURITY_HEADERS = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...headers } });

export const error = (status, message, extra = {}) => json({ error: message, ...extra }, status);

const digest = s => createHash('sha256').update(String(s)).digest();

// Admin auth: a long random ADMIN_TOKEN env var, compared in constant time.
export function isAdmin(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 24) return false;
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token.length > 0 && timingSafeEqual(digest(token), digest(expected));
}

// Identify real image types from their first bytes — never trust the client's MIME type.
export function sniffImage(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { type: 'image/webp', ext: 'webp' };
  return null;
}

export function clean(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
