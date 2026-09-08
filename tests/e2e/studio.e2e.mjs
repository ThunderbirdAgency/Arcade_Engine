// End-to-end for the Polyester Publishing shell: public landing, login gate, workshop build, share link.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const PASSWORD = process.env.STUDIO_PASSWORD || 'polyester';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|fonts|404|401/.test(m.text())) errors.push(m.text()); });

// Public landing shows the press, not the engine.
await page.goto(BASE + '/');
assert.equal(await page.title(), 'Polyester Publishing');
assert.ok(!(await page.content()).toLowerCase().includes('arcadeengine'));
// Protected routes redirect anonymous visitors; JSON gets 401.
await page.goto(BASE + '/studio/'); await page.waitForURL(/\/login\//);
const r401 = await page.request.get(BASE + '/games/index.json'); assert.equal(r401.status(), 401);
// Wrong password, then right password.
await page.fill('#password', 'wrong'); await page.click('#go');
await page.waitForFunction(() => document.getElementById('err').textContent.length > 0);
await page.fill('#password', PASSWORD); await page.click('#go');
await page.waitForURL(/\/studio\//);
assert.equal(await page.title(), 'Workshop · Polyester Publishing');
await page.waitForFunction(() => document.querySelectorAll('#games li').length > 0);
const games = await page.$$eval('#games li b', els => els.map(e => e.textContent));
assert.ok(games.includes('Credit’s Lair'));

// Fill a small brief and build.
await page.fill('input[name=title]', 'The Salt Road');
await page.fill('textarea[name=look]', 'Woodcut-style animation, ink and sea-fog grey.');
await page.click('button[data-add=characters]');
await page.fill('#characters .item:last-child input[data-k=name]', 'Mara');
await page.fill('#characters .item:last-child textarea[data-k=description]', 'Mara, a tall salt trader in a grey wool coat');
await page.fill('#locations .item:first-child input[data-k=name]', 'The Pier');
await page.fill('#locations .item:first-child textarea[data-k=description]', 'a long wooden pier in sea fog');
await page.fill('#scenes .item:first-child input[data-k=title]', 'The Pier');
await page.fill('#scenes .item:first-child input[data-k=location]', 'The Pier');
await page.fill('#scenes .item:first-child input[data-k=cast]', 'Mara');
await page.fill('#scenes .item:first-child textarea[data-k=setup]', 'Mara walks the pier; a gull dives from the RIGHT at second 3.');
await page.fill('#scenes .item:first-child input[data-k=cue]', 'Gull! Duck!');
await page.selectOption('#scenes .item:first-child select[data-k=move]', 'down');
await page.selectOption('#scenes .item:first-child select[data-k=wrongMove]', 'up');
await page.fill('#scenes .item:first-child textarea[data-k=win]', 'Mara ducks and the gull sails over.');
await page.fill('#scenes .item:first-child textarea[data-k=fail]', 'Mara swats, loses her hat, sits down hard.');
await page.click('#build');
await page.waitForSelector('#out:not([hidden])');
const lint = await page.$eval('#lint', e => e.textContent);
assert.ok(lint.startsWith('✓ lints clean'), lint);
const mjs = await page.$eval('#mjs', e => e.textContent);
assert.ok(mjs.includes("slug\": \"the-salt-road\"") && mjs.includes('"the-pier-fail"'));
// Persisted in the browser: reload keeps the project.
await page.reload();
await page.waitForFunction(() => document.querySelector('#projects button')?.textContent === 'The Salt Road');
assert.equal(await page.inputValue('input[name=title]'), 'The Salt Road');

// Share link: a fresh context with no password can open only that game.
await page.evaluate(() => navigator.clipboard.writeText(''));
const share = await page.request.post(BASE + '/api/studio/share', { data: { game: 'credits-lair', days: 3 } });
const { url } = await share.json();
const guest = await (await browser.newContext()).newPage();
await guest.goto(url);
await guest.waitForURL(/\/play\/\?game=credits-lair$/);
await guest.waitForFunction(() => document.title.startsWith('Credit'));
assert.equal((await guest.request.get(BASE + '/games/lantern-bridge/game.json')).status(), 401);
await guest.goto(BASE + '/studio/'); await guest.waitForURL(/\/login\//);

// Sign out.
await page.click('#logout'); await page.waitForURL(BASE + '/');
await page.goto(BASE + '/studio/'); await page.waitForURL(/\/login\//);
await browser.close();
assert.deepEqual(errors, [], errors.join(' | '));
console.log('Studio e2e passed: public landing, login gate, workshop build, persistence, share link scope, sign out.');
