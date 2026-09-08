// Vercel Edge Middleware: gates the workshop and the games behind the Polyester Publishing password session.
// A share token in the URL (?share=...) grants a scoped session for one game so links can be handed out.
import { verify, sign, COOKIE, cookieHeader, parseCookies, isProtected } from './studio/token.mjs';

export const config = { matcher: ['/((?!favicon.ico|_vercel).*)'] };

const next = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (!isProtected(path)) return next();
  const secret = process.env.STUDIO_SECRET;
  if (!secret) return new Response('The workshop is not configured (STUDIO_SECRET missing).', { status: 503 });

  const session = await verify(parseCookies(request.headers.get('cookie') || '')[COOKIE], secret);
  const game = url.searchParams.get('game');
  if (session && (session.scope === 'all' || (session.scope === 'game' && allowsGame(session, path, game)))) return next();

  // Share link: ?share=<token> on /play grants a game-scoped session for that game.
  const share = url.searchParams.get('share');
  if (share) {
    const grant = await verify(share, secret);
    if (grant?.scope === 'game' && grant.game && (!game || game === grant.game)) {
      const cookie = await sign({ scope: 'game', game: grant.game, exp: Math.min(grant.exp, Date.now() + 30 * 86400e3) }, secret);
      url.searchParams.delete('share'); url.searchParams.set('game', grant.game);
      return new Response(null, { status: 302, headers: { Location: url.pathname + url.search, 'Set-Cookie': cookieHeader(cookie, { secure: url.protocol === 'https:' }) } });
    }
  }

  if (path.startsWith('/api/')) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const wantsPage = (request.headers.get('accept') || '').includes('text/html');
  if (!wantsPage) return new Response('unauthorized', { status: 401 });
  const back = encodeURIComponent(url.pathname + url.search);
  return new Response(null, { status: 302, headers: { Location: `/login/?next=${back}`, 'Cache-Control': 'no-store' } });
}

/** A game-scoped session may load /play, its own game.json, its films, the engine and shared assets. */
function allowsGame(session, path, game) {
  if (path === '/play' || path.startsWith('/play/')) return !game || game === session.game;
  if (path === '/games/index.json' || path.startsWith('/engine') || path.startsWith('/assets')) return true;
  if (path.startsWith(`/games/${session.game}/`)) return true;
  return false;
}
