// Local preview that mirrors Vercel: static files from dist, Edge middleware from middleware.js,
// and Node functions from api/. Sets STUDIO_* defaults so the workshop works out of the box locally.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.STUDIO_PASSWORD ||= 'polyester';
process.env.STUDIO_SECRET ||= 'local-dev-secret-change-me';

const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown' };
const port = Number(process.env.PORT || 4173);
const middleware = (await import(pathToFileURL(path.resolve('middleware.js')).href)).default;

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    // 1. Edge middleware
    req.headers['x-forwarded-proto'] ||= 'http';
    const mw = await middleware(new Request(url, { method: req.method, headers: req.headers }));
    if (mw && !mw.headers.get('x-middleware-next')) {
      res.writeHead(mw.status, Object.fromEntries(mw.headers));
      res.end(Buffer.from(await mw.arrayBuffer())); return;
    }
    // 2. API functions
    if (url.pathname.startsWith('/api/')) {
      const file = path.resolve('api', url.pathname.slice(5).replace(/\/$/, '') + '.mjs');
      if (!file.startsWith(path.resolve('api')) || !fs.existsSync(file)) { res.writeHead(404).end('no such function'); return; }
      const handler = (await import(pathToFileURL(file).href + `?t=${Date.now()}`)).default;
      const ct = req.headers['content-type'] || '';
      const body = raw.length ? (ct.includes('json') ? JSON.parse(raw.toString()) : raw.toString()) : undefined;
      const vreq = Object.assign(req, { body, query: Object.fromEntries(url.searchParams), cookies: Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(c => c.trim().split('=').map(decodeURIComponent))) });
      const vres = { setHeader: (k, v) => res.setHeader(k, v), status(c) { res.statusCode = c; return this; }, json(o) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); }, send(s) { res.end(s); }, end: s => res.end(s), get statusCode() { return res.statusCode; }, set statusCode(c) { res.statusCode = c; } };
      await handler(vreq, vres); return;
    }
    // 3. Static files
    let rel; try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
    let file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
    let stat; try { stat = fs.statSync(file); if (!stat.isFile()) throw 0; } catch { res.writeHead(404).end('Not found'); return; }
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) { const start = +range[1], end = range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1; if (start > end) { res.writeHead(416).end(); return; } res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 }); fs.createReadStream(file, { start, end }).pipe(res); }
    else { res.writeHead(200, { ...headers, 'Content-Length': stat.size }); fs.createReadStream(file).pipe(res); }
  } catch (e) { console.error(e); res.writeHead(500).end('error'); }
}).listen(port, '0.0.0.0', () => console.log(`Polyester Publishing preview on http://localhost:${port}  (password: ${process.env.STUDIO_PASSWORD})`));
