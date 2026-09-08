// Build dist/: copy the web shell (recursively) and engine, expose the studio modules the browser needs,
// compile every story, write the games index.
import fs from 'node:fs';
import path from 'node:path';
import { listStories, compileToDisk } from '../pipeline/compile.mjs';
import { formatLint } from '../pipeline/lint.mjs';

const dist = 'dist';
fs.mkdirSync(path.join(dist, 'engine'), { recursive: true });
fs.mkdirSync(path.join(dist, 'studio'), { recursive: true });
fs.cpSync('web', dist, { recursive: true });
for (const f of fs.readdirSync('engine').filter(f => f.endsWith('.mjs'))) fs.copyFileSync(path.join('engine', f), path.join(dist, 'engine', f));
// The workshop runs the scaffold and the linter in the browser; the linter only imports engine/graph + prompts (crypto-free path).
fs.copyFileSync('studio/scaffold.mjs', path.join(dist, 'studio', 'scaffold.mjs'));
fs.writeFileSync(path.join(dist, 'studio', 'lint.mjs'), fs.readFileSync('pipeline/lint.mjs', 'utf8').replace("from '../engine/graph.mjs'", "from '/engine/graph.mjs'").replace("from './prompts.mjs'", "from '/studio/prompts.mjs'"));
fs.writeFileSync(path.join(dist, 'studio', 'prompts.mjs'), fs.readFileSync('pipeline/prompts.mjs', 'utf8').replace("import { createHash } from 'node:crypto';\n", '').replace(/export function promptHash[\s\S]*?\n}\n/, 'export function promptHash() { return "browser"; }\n'));

const games = [];
let failed = false;
for (const slug of listStories()) {
  const r = await compileToDisk(slug, { distDir: dist });
  const { game, lint, status } = r;
  games.push({ slug, title: game.title, episode: game.episode, tagline: game.tagline, poster: game.poster, playable: game.playable, films: `${status.ready}/${status.shots}` });
  const flag = game.playable ? 'playable' : `not playable (${status.missing.length} films missing)`;
  console.log(`• ${slug}: ${status.ready}/${status.shots} films ready, ${flag}${status.drifted.length ? `, ${status.drifted.length} drifted from current prompts` : ''}`);
  if (lint.errors.length || lint.warnings.length) console.log(formatLint(lint));
  if (lint.errors.length) failed = true;
}
fs.mkdirSync(path.join(dist, 'games'), { recursive: true });
fs.writeFileSync(path.join(dist, 'games', 'index.json'), JSON.stringify({ games }, null, 2));
if (failed) { console.error('Build failed: fix the lint errors above.'); process.exit(1); }
console.log(`Built ${games.length} game(s) into ${dist}/games.`);
