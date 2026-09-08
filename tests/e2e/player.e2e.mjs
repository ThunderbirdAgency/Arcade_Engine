// End-to-end: drives the real player in headless Chromium against the dev server with synthetic films.
// Run: node scripts/dev.mjs & then node tests/e2e/player.e2e.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { makeFilms } from './make-films.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const game = JSON.parse(fs.readFileSync('dist/games/credits-lair/game.json', 'utf8'));
const clips = Object.keys(game.clips);
const filmDir = 'tests/e2e/films';
if (!clips.every(c => fs.existsSync(path.join(filmDir, `${c}.webm`)))) await makeFilms(clips, filmDir);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|404/.test(m.text())) errors.push(m.text()); });
await page.route('**/games/credits-lair/game.json', route => {
  const g = structuredClone(game);
  for (const c of Object.keys(g.clips)) g.clips[c].src = `/test-films/${c}.webm`;
  route.fulfill({ contentType: 'application/json', body: JSON.stringify(g) });
});
await page.route('**/test-films/*.webm', route => {
  const name = route.request().url().split('/').pop();
  route.fulfill({ contentType: 'video/webm', body: fs.readFileSync(path.join(filmDir, name)) });
});

const played = [];
await page.exposeFunction('__played', src => played.push(src.split('/').pop()));
await page.addInitScript(() => {
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  Object.defineProperty(HTMLMediaElement.prototype, 'src', { set(v) { window.__played?.(v); desc.set.call(this, v); }, get() { return desc.get.call(this); } });
});

// Sign in through the Polyester Publishing staff door first (the games sit behind the password).
await page.goto(`${BASE}/play/?game=credits-lair`);
await page.waitForURL(/\/login\/\?next=/);
await page.fill('#password', process.env.STUDIO_PASSWORD || 'polyester');
await page.click('#go');
await page.waitForURL(/\/play\/\?game=credits-lair/);
await page.waitForFunction(() => document.title.startsWith('Credit'));
assert.equal(await page.title(), 'Credit’s Lair · ArcadeEngine');
const status = () => page.$eval('#status', e => e.textContent);
const overlayTitle = () => page.$eval('#overlay-title', e => e.textContent);

async function waitForCue() { await page.waitForSelector('#cue-panel:not([hidden])', { timeout: 15000 }); }
async function continueOverlay(label) {
  await page.waitForSelector('#overlay:not([hidden])', { timeout: 15000 });
  await page.waitForSelector(`#overlay-actions button:has-text("${label}")`, { timeout: 15000 });
  await page.$eval(`#overlay-actions button:has-text("${label}")`, b => b.click());
}

// Run 1: arcade, wrong move then correct path, keyboard and mouse.
await page.click('#start');
await waitForCue();
assert.equal(await page.$eval('#cue-text', e => e.textContent), 'Stone on the right. Dodge left!');
const labels = await page.$$eval('#moves .move b', bs => bs.map(b => b.textContent));
assert.deepEqual(labels, ['Dodge left', 'Run right']);
await page.click('#moves .move:has-text("Run right")');
await page.waitForFunction(() => document.getElementById('status').textContent === 'WRONG MOVE' || document.getElementById('status').textContent === 'A COMEDIC SETBACK');
await continueOverlay('Retry');
assert.equal(await page.$eval('#lives', e => e.textContent), '◆◆◇ · 0 POINTS');
await waitForCue();
await page.keyboard.press('ArrowLeft');
await continueOverlay('Continue');
assert.equal(await page.$eval('#lives', e => e.textContent), '◆◆◇ · 100 POINTS');
await waitForCue();
assert.equal(await page.$eval('#chapter', e => e.textContent), 'II · THE FINE PRINT');
await page.keyboard.press('a');
await continueOverlay('Continue');
await waitForCue();
await page.keyboard.press('Space');
await continueOverlay('Continue');
await page.waitForSelector('#overlay:not([hidden])');
assert.equal(await overlayTitle(), 'Rich in gold. Richer in judgment.');
assert.equal(await page.$eval('.stats', e => e.textContent), '300 points · 3 good moves · 1 setback');
assert.equal(await page.$$eval('.recap li', l => l.length), 3);
assert.deepEqual(played, ['gate-threat.webm', 'gate-fail.webm', 'gate-threat.webm', 'gate-win.webm', 'merchant-threat.webm', 'merchant-win.webm', 'dragon-threat.webm', 'dragon-win.webm']);

// Run 2: timeouts burn all lives, then practice mode holds the film.
await page.$eval('#overlay-actions button:has-text("Play again")', b => b.click());
for (let i = 0; i < 3; i++) { await waitForCue(); await continueOverlay('Retry').catch(() => {}); }
await page.waitForFunction(() => document.getElementById('overlay-kicker').textContent === 'OUT OF LIVES', null, { timeout: 30000 });
await page.$eval('#overlay-actions button:has-text("Practice")', b => b.click());
await waitForCue();
assert.equal(await status(), 'GUIDED MODE · CHOOSE WHEN READY');
const pausedAtCue = await page.$eval('video:not([hidden])', v => v.paused);
assert.equal(pausedAtCue, true, 'guided mode holds the film');
await page.click('#moves .move:has-text("Dodge left")');
await continueOverlay('Continue');

// Pause and resume with the keyboard (once the next film is actually rolling).
await page.waitForFunction(() => { const v = document.querySelector('video:not([hidden])'); return v && !v.paused && v.currentTime > 0.3; }, null, { timeout: 15000 });
await page.keyboard.press('p');
await page.waitForSelector('#overlay:not([hidden])');
assert.equal(await page.$eval('#overlay-kicker', e => e.textContent), 'INTERMISSION');
await page.keyboard.press('Escape');
await page.waitForFunction(() => document.getElementById('overlay').hidden);

await page.screenshot({ path: 'tests/e2e/last-run.png' });
await browser.close();
assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
console.log('Player e2e passed: full quest, deaths, game over, practice mode, pause/resume, keyboard and mouse.');
