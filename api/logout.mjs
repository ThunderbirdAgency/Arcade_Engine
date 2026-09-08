import { COOKIE } from '../studio/token.mjs';
export default function handler(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST') return res.status(200).json({ ok: true });
  res.statusCode = 302; res.setHeader('Location', '/'); res.end();
}
