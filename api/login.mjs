// POST /api/login { password } → sets the session cookie. One password, from STUDIO_PASSWORD.
import { sign, safeEqual, cookieHeader, SESSION_DAYS } from '../studio/token.mjs';

const attempts = new Map(); // per-instance throttle: ip → { count, until }
const WINDOW_MS = 15 * 60e3, MAX = 8;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const password = process.env.STUDIO_PASSWORD, secret = process.env.STUDIO_SECRET;
  if (!password || !secret) return res.status(503).json({ error: 'The workshop is not configured. Set STUDIO_PASSWORD and STUDIO_SECRET.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const a = attempts.get(ip) || { count: 0, until: 0 };
  if (a.until > now) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  // Honeypot: real users never fill "company"; bots that do are throttled silently.
  if (body.company) { attempts.set(ip, { count: MAX, until: now + WINDOW_MS }); return res.status(200).json({ ok: true, redirect: '/' }); }

  const ok = safeEqual(String(body.password || ''), password);
  if (!ok) {
    const count = a.count + 1;
    attempts.set(ip, { count, until: count >= MAX ? now + WINDOW_MS : 0 });
    await new Promise(r => setTimeout(r, 700));
    return res.status(401).json({ error: 'That password is not on file.' });
  }
  attempts.delete(ip);
  const token = await sign({ scope: 'all', iat: now, exp: now + SESSION_DAYS * 86400e3 }, secret);
  res.setHeader('Set-Cookie', cookieHeader(token, { secure: !req.headers.host?.startsWith('localhost') && !req.headers.host?.startsWith('127.') }));
  const next = typeof body.next === 'string' && body.next.startsWith('/') && !body.next.startsWith('//') ? body.next : '/studio/';
  return res.status(200).json({ ok: true, redirect: next });
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
