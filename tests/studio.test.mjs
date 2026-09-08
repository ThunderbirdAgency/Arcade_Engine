import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, safeEqual, parseCookies, isProtected, COOKIE } from '../studio/token.mjs';
import { emptyBrief, briefToStory, briefToMarkdown, storyToModule, slugify } from '../studio/scaffold.mjs';
import { lintStory } from '../pipeline/lint.mjs';
import middleware from '../middleware.js';
import login from '../api/login.mjs';
import share from '../api/studio/share.mjs';

const SECRET = 'test-secret';
process.env.STUDIO_SECRET = SECRET; process.env.STUDIO_PASSWORD = 'open-sesame';

test('tokens round-trip, reject tampering and expiry', async () => {
  const t = await sign({ scope: 'all', exp: Date.now() + 1000 }, SECRET);
  assert.equal((await verify(t, SECRET)).scope, 'all');
  assert.equal(await verify(t, 'other'), null);
  assert.equal(await verify(t.slice(0, -2) + 'zz', SECRET), null);
  assert.equal(await verify(await sign({ scope: 'all', exp: Date.now() - 1 }, SECRET), SECRET), null);
  assert.ok(safeEqual('abc', 'abc')); assert.ok(!safeEqual('abc', 'abd')); assert.ok(!safeEqual('abc', 'abcd'));
  assert.deepEqual(parseCookies('a=1; pp_session=x.y'), { a: '1', pp_session: 'x.y' });
});

test('protected paths', () => {
  for (const p of ['/play', '/play/', '/studio', '/games/index.json', '/engine/core.mjs', '/assets/films/x.mp4', '/story.html', '/api/studio/draft']) assert.ok(isProtected(p), p);
  for (const p of ['/', '/login', '/login/', '/site.css', '/api/login', '/api/logout']) assert.ok(!isProtected(p), p);
});

const req = (url, headers = {}) => new Request(`https://press.test${url}`, { headers: { accept: 'text/html', ...headers } });
test('middleware: public passes, protected redirects to login, session passes, share grants a scoped cookie', async () => {
  assert.equal((await middleware(req('/'))).headers.get('x-middleware-next'), '1');
  const r = await middleware(req('/studio/'));
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/login/?next=%2Fstudio%2F');
  assert.equal((await middleware(req('/games/index.json', { accept: 'application/json' }))).status, 401);
  const cookie = `${COOKIE}=${await sign({ scope: 'all', exp: Date.now() + 1e6 }, SECRET)}`;
  assert.equal((await middleware(req('/studio/', { cookie }))).headers.get('x-middleware-next'), '1');
  const shareTok = await sign({ scope: 'game', game: 'credits-lair', exp: Date.now() + 1e6 }, SECRET);
  const s = await middleware(req(`/play/?game=credits-lair&share=${shareTok}`));
  assert.equal(s.status, 302); assert.equal(s.headers.get('location'), '/play/?game=credits-lair');
  const scoped = parseCookies(s.headers.get('set-cookie'))[COOKIE];
  const c2 = `${COOKIE}=${scoped}`;
  assert.equal((await middleware(req('/play/?game=credits-lair', { cookie: c2 }))).headers.get('x-middleware-next'), '1');
  assert.equal((await middleware(req('/games/credits-lair/game.json', { cookie: c2, accept: '*/*' }))).headers.get('x-middleware-next'), '1');
  assert.equal((await middleware(req('/games/lantern-bridge/game.json', { cookie: c2, accept: '*/*' }))).status, 401, 'scoped session cannot read other games');
  assert.equal((await middleware(req('/studio/', { cookie: c2 }))).status, 302, 'scoped session cannot enter the workshop');
});

function fakeRes() { const r = { headers: {}, code: 200, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() {} }; return r; }
test('login: wrong password 401 with delay, right password sets a cookie, honeypot is trapped', async () => {
  const mk = (body, ip) => ({ method: 'POST', headers: { 'x-forwarded-for': ip, host: 'press.test' }, body });
  let res = fakeRes(); await login(mk({ password: 'nope' }, '1.1.1.1'), res); assert.equal(res.code, 401);
  res = fakeRes(); await login(mk({ password: 'open-sesame', next: '/play/' }, '1.1.1.1'), res);
  assert.equal(res.code, 200); assert.equal(res.body.redirect, '/play/'); assert.match(res.headers['Set-Cookie'], /pp_session=.+HttpOnly/);
  const payload = await verify(parseCookies(res.headers['Set-Cookie'])[COOKIE], SECRET); assert.equal(payload.scope, 'all');
  res = fakeRes(); await login(mk({ password: 'open-sesame', next: '//evil' }, '1.1.1.1'), res); assert.equal(res.body.redirect, '/studio/');
  res = fakeRes(); await login(mk({ password: 'open-sesame', company: 'bot inc' }, '2.2.2.2'), res); assert.equal(res.headers['Set-Cookie'], undefined);
  res = fakeRes(); await login(mk({ password: 'open-sesame' }, '2.2.2.2'), res); assert.equal(res.code, 429, 'honeypot trips the throttle');
  res = fakeRes(); await share({ method: 'POST', headers: { host: 'press.test', 'x-forwarded-proto': 'https' }, body: { game: 'credits-lair', days: 7 } }, res);
  assert.match(res.body.url, /^https:\/\/press\.test\/play\/\?game=credits-lair&share=/);
});

test('scaffold: an empty brief and a filled brief both lint clean; markdown carries the answers', () => {
  const empty = { ...emptyBrief(), title: 'Blank' };
  const s0 = briefToStory(empty);
  assert.deepEqual(lintStory(s0).errors, []);
  assert.equal(s0.slug, 'blank');
  const b = { ...emptyBrief(), title: 'The Salt Road', episode: 'EPISODE 01', look: 'Woodcut-style animation', lesson: 'Pack for the weather.',
    characters: [{ name: 'Mara', description: 'Mara, a tall salt trader in a grey wool coat', rules: 'Never change the coat.' }, { name: 'The Gull', description: 'a huge grey gull with a red eye' }],
    locations: [{ name: 'The Pier', description: 'a long wooden pier in sea fog' }, { name: 'The Dunes', description: 'wind-cut dunes under a white sky' }],
    scenes: [
      { title: 'The Pier', location: 'The Pier', cast: 'Mara, The Gull', setup: 'Mara walks the pier; the gull dives from the RIGHT at second 3.', danger: 'The gull dives.', cue: 'Gull! Duck!', move: 'down', moveLabel: 'Duck', win: 'Mara ducks and the gull sails over.', wrongMove: 'up', wrongLabel: 'Swat it', fail: 'Mara swats, loses her hat, sits down hard.', lesson: 'Do not fight the weather.' },
      { title: 'The Dunes', location: 'The Dunes', cast: 'Mara', setup: 'Sand slides on the LEFT.', danger: 'A slide.', cue: 'Slide! Go right!', move: 'right', win: 'Mara runs right.', wrongMove: 'left', fail: 'Mara is buried to the waist, comically.' },
    ], endingTitle: 'Salt delivered.', endingBody: 'Mara made it.', secretEnding: '' };
  const s = briefToStory(b);
  const lint = lintStory(s);
  assert.deepEqual(lint.errors, [], JSON.stringify(lint.errors));
  assert.deepEqual(Object.keys(s.characters), ['mara', 'the-gull']);
  assert.deepEqual(s.nodes['the-pier'].cast, ['mara', 'the-gull']);
  assert.equal(s.nodes['the-pier'].beats[0].moves.down.to, 'the-pier-win');
  assert.equal(s.nodes['the-pier-win'].next, 'the-dunes');
  assert.equal(s.nodes['the-dunes'].transition, true, 'location change is declared');
  assert.equal(s.nodes['the-dunes-win'].next, 'end');
  assert.equal(s.nodes['the-pier-fail'].retry, 'the-pier');
  const md = briefToMarkdown(b);
  assert.ok(md.includes('# The Salt Road · story brief') && md.includes('### 2. The Dunes') && md.includes('Pack for the weather.'));
  const mod = storyToModule(s);
  assert.ok(mod.startsWith('// The Salt Road') && mod.includes('export default {'));
  assert.equal(slugify('Credit’s Lair!'), 'credit-s-lair');
});
