// POST /api/studio/share { game, days } → a share URL that opens one game without the password.
import { sign } from '../../studio/token.mjs';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const secret = process.env.STUDIO_SECRET;
  if (!secret) return res.status(503).json({ error: 'STUDIO_SECRET missing' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const game = String(body.game || '');
  if (!/^[a-z0-9-]+$/.test(game)) return res.status(400).json({ error: 'game slug required' });
  const days = Math.min(365, Math.max(1, Number(body.days) || 30));
  const token = await sign({ scope: 'game', game, exp: Date.now() + days * 86400e3 }, secret);
  const host = req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  const url = `${proto}://${req.headers.host}/play/?game=${game}&share=${token}`;
  return res.status(200).json({ url, days });
}
