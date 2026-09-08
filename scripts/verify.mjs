// Build + verify. This is the Vercel build command and the local `npm test`.
// 1. Syntax-check every module. 2. Unit tests (engine, compiler, pipeline). 3. Build dist (compile every story).
// 4. Legacy illustrated-story checks (dist/story.html) kept from 1.0. 5. Asset and manifest integrity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { scenes } from '../dist/story.mjs';
import { initialState, applyEffect, ending } from '../dist/core.mjs';

const run = (args, opts = {}) => execFileSync(process.execPath, args, { stdio: 'inherit', ...opts });
const files = dir => fs.readdirSync(dir).filter(f => f.endsWith('.mjs') || f.endsWith('.js')).map(f => path.join(dir, f));
for (const f of [...files('engine'), ...files('pipeline'), ...files('pipeline/providers'), ...files('scripts'), 'dist/app.js', 'dist/story.mjs', 'dist/core.mjs']) run(['--check', f]);

run(['--test', 'tests/core.test.mjs', 'tests/compile.test.mjs', 'tests/pipeline.test.mjs']);
run(['scripts/build.mjs']);

// Every compiled game: clips referenced by nodes exist in the manifest and on disk (local srcs), index lists it.
const index = JSON.parse(fs.readFileSync('dist/games/index.json', 'utf8'));
for (const g of index.games) {
  const game = JSON.parse(fs.readFileSync(`dist/games/${g.slug}/game.json`, 'utf8'));
  assert.equal(game.slug, g.slug);
  for (const [id, n] of Object.entries(game.nodes)) {
    if (!n.clip) continue;
    const c = game.clips[n.clip];
    if (game.playable) { assert(c?.src, `${g.slug}: node ${id} references missing clip ${n.clip}`); }
    if (c?.src?.startsWith('/')) { assert(!c.src.includes('..')); assert(fs.existsSync('dist' + c.src), `${g.slug}: film missing on disk ${c.src}`); }
    else if (c?.src) assert.equal(new URL(c.src).protocol, 'https:');
  }
}
assert(index.games.some(g => g.slug === 'credits-lair' && g.playable), 'Credit’s Lair must stay playable');
for (const f of ['dist/index.html', 'dist/arcade.css', 'dist/engine/player.mjs', 'dist/engine/core.mjs', 'dist/engine/graph.mjs']) assert(fs.existsSync(f), `missing ${f}`);
const html = fs.readFileSync('dist/index.html', 'utf8');
for (const m of html.matchAll(/(?:href|src)="(\/(?!\/)[^"#?]*)"/g)) if (m[1] !== '/') assert(fs.existsSync('dist' + m[1]), `Missing ${m[1]}`);

// Legacy illustrated story (story.html): 30 paths, 14 scenes, 3 endings, assets present.
let paths = 0; const reached = new Set(), outcomes = new Set();
function walk(id, state, p = []) {
  assert(p.length < 25, 'Unexpected story cycle'); assert(scenes[id], `Unknown scene ${id}`); reached.add(id);
  assert(state.coins >= 0 && state.debt >= 0, 'Invalid balance');
  if (id === 'ending') { assert.equal(state.decision, 3); outcomes.add(ending(state).title); paths++; return; }
  if (id === 'vault') { walk('reward', applyEffect(state, 'reward'), [...p, id]); return; }
  for (const c of scenes[id].choices) walk(c.next, c.effect ? applyEffect(state, c.effect) : state, [...p, id]);
}
walk('arrival', initialState()); assert.equal(reached.size, Object.keys(scenes).length); assert.equal(outcomes.size, 3);
let s = initialState(); for (const e of ['cash', 'charm', 'repair', 'reward', 'pay']) s = applyEffect(s, e); assert.equal(s.coins, 250); assert.equal(s.debt, 0);
for (const scene of Object.values(scenes)) assert(fs.existsSync(`dist/assets/${scene.art}.webp`));
const media = JSON.parse(fs.readFileSync('dist/media.json'));
for (const [id, entry] of Object.entries(media)) { assert(scenes[id]); const src = typeof entry === 'string' ? entry : entry.src; assert(src.startsWith('/assets/') && !src.includes('..')); assert(fs.existsSync('dist' + src)); }
console.log(`ArcadeEngine verified: ${index.games.length} game(s) built (${index.games.filter(g => g.playable).length} playable); legacy story ${paths} paths, ${reached.size} scenes, ${outcomes.size} endings.`);
