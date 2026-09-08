// Build dist/: copy the web shell and engine, compile every story, write the games index.
import fs from 'node:fs';
import path from 'node:path';
import { listStories, compileToDisk } from '../pipeline/compile.mjs';
import { formatLint } from '../pipeline/lint.mjs';

const dist = 'dist';
fs.mkdirSync(path.join(dist, 'engine'), { recursive: true });
for (const f of fs.readdirSync('web')) fs.copyFileSync(path.join('web', f), path.join(dist, f));
for (const f of fs.readdirSync('engine').filter(f => f.endsWith('.mjs'))) fs.copyFileSync(path.join('engine', f), path.join(dist, 'engine', f));

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
