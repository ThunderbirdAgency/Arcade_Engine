// Signed session tokens using Web Crypto so the same code runs in Vercel Edge Middleware and Node functions.
// Token = base64url(payload JSON) + '.' + base64url(HMAC-SHA256(payloadB64, secret)).
const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));

async function key(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function sign(payload, secret) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body));
  return `${body}.${b64u(mac)}`;
}

/** Returns the payload when the signature is valid and not expired, else null. */
export async function verify(token, secret) {
  if (!token || !secret || typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await key(secret), unb64u(mac), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

/** Constant-time string comparison for the password check. */
export function safeEqual(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const COOKIE = 'pp_session';
export const SESSION_DAYS = 30;
export function cookieHeader(token, { maxAge = SESSION_DAYS * 86400, secure = true } = {}) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}

/** Paths that need a session. Everything else (the Polyester Publishing site) is public. */
export const PROTECTED = ['/play', '/studio', '/games', '/engine', '/assets', '/story.html', '/story.mjs', '/core.mjs', '/app.js', '/media.json', '/production-pack.json', '/style.css', '/api/studio'];
export const isProtected = pathname => PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/') || (p.includes('.') && pathname === p));
