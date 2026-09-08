#!/usr/bin/env node
// ArcadeEngine story CLI.
//   node scripts/story.mjs list
//   node scripts/story.mjs <slug> lint | compile | status | pack [--all] [--only a,b] | plan | ingest [results.json] | review [--manual] [--only a,b] | stitch | golden
import fs from 'node:fs';
import path from 'node:path';
import { listStories, loadStory, loadMedia, compileStory, compileToDisk, STORIES_DIR } from '../pipeline/compile.mjs';
import { formatLint } from '../pipeline/lint.mjs';
import { buildPack } from '../pipeline/pack.mjs';
import { ingest } from '../pipeline/ingest.mjs';
import { review } from '../pipeline/review.mjs';
import { stitch, goldenClips } from '../pipeline/stitch.mjs';
import * as session from '../pipeline/providers/session.mjs';

const [slug, cmd = 'status', ...rest] = process.argv.slice(2);
const flag = name => rest.includes(`--${name}`);
const opt = name => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : null; };
const only = opt('only')?.split(',') || null;

if (!slug || slug === 'list') {
  for (const s of listStories()) console.log(s);
  process.exit(0);
}

const story = await loadStory(slug);
const media = loadMedia(slug);
const result = compileStory(story, media);

switch (cmd) {
  case 'lint': {
    console.log(result.lint.errors.length ? formatLint(result.lint) : `✓ ${slug} lints clean${result.lint.warnings.length ? `\n${formatLint(result.lint)}` : ''}`);
    process.exit(result.lint.errors.length ? 1 : 0);
  }
  case 'compile': {
    const r = await compileToDisk(slug);
    console.log(`${slug}: ${r.status.ready}/${r.status.shots} films ready · playable=${r.game.playable} · wrote dist/games/${slug}/game.json and stories/${slug}/shots.json`);
    if (r.lint.errors.length || r.lint.warnings.length) console.log(formatLint(r.lint));
    process.exit(r.lint.errors.length ? 1 : 0);
  }
  case 'status': {
    console.log(`${story.title} (${slug}) · ${Object.keys(story.nodes).length} nodes · ${result.status.shots} films · playable=${result.game.playable}`);
    for (const s of result.shots.shots) {
      const e = media.clips?.[s.clip];
      const mark = s.status === 'ready' ? '✓' : s.status === 'drifted' ? '↻' : '·';
      console.log(`  ${mark} ${s.clip.padEnd(24)} ${s.kind.padEnd(6)} ${s.status.padEnd(8)} ${e?.review?.status || ''}${e?.duration ? ` ${e.duration}s` : ''}`);
    }
    console.log(`  golden path: ${result.status.golden.join(' → ')}`);
    if (result.lint.errors.length || result.lint.warnings.length) console.log(formatLint(result.lint));
    break;
  }
  case 'pack': {
    const pack = buildPack(result.shots, media, { only, includeReady: flag('all') });
    const file = path.join(STORIES_DIR, slug, 'pack.json');
    fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n');
    console.log(`wrote ${file}: ${pack.stages.assets.length} asset request(s), ${pack.stages.films.length} film request(s)`);
    console.log(session.instructions(pack));
    break;
  }
  case 'plan': {
    const pack = buildPack(result.shots, media, { only, includeReady: flag('all') });
    for (const a of pack.stages.assets) console.log(`ASSET ${a.id}\n  ${a.params.prompt}\n`);
    for (const f of pack.stages.films) console.log(`FILM ${f.clip} (${f.status})${f.dependsOn.length ? ` after ${f.dependsOn.join(', ')}` : ''}\n  medias: ${f.params.medias.map(m => `${m.role}=${m.value}`).join(' ')}\n  ${f.params.prompt}\n  verify: ${f.verify.join(' | ')}\n`);
    break;
  }
  case 'ingest': {
    const file = rest.find(a => a.endsWith('.json')) || path.join(STORIES_DIR, slug, 'results.json');
    if (!fs.existsSync(file)) { console.error(`No results file at ${file}`); process.exit(1); }
    const results = JSON.parse(fs.readFileSync(file, 'utf8'));
    const report = await ingest(slug, result.shots, results.jobs || results, { frames: !flag('no-frames') });
    for (const r of report) console.log(`  ${r.clip}: ${r.error || `${r.duration}s ${r.size}${r.problems?.length ? ' · ' + r.problems.join('; ') : ''}`}`);
    await compileToDisk(slug);
    break;
  }
  case 'review': {
    const out = await review(slug, result.shots, { only, mode: flag('manual') ? 'manual' : 'auto', frames: !flag('no-frames') });
    for (const r of out) console.log(`  ${r.clip}: ${r.status}${r.issues?.length ? ' · ' + r.issues.join('; ') : ''}${r.note ? ' · ' + r.note : ''}`);
    await compileToDisk(slug);
    break;
  }
  case 'golden': console.log(goldenClips(story).join(' → ')); break;
  case 'stitch': {
    const r = stitch(story);
    console.log(r.ok ? `wrote ${r.out}` : `not stitched: ${r.missing?.length ? 'missing ' + r.missing.join(', ') : r.note}`);
    break;
  }
  default: console.error(`Unknown command ${cmd}`); process.exit(1);
}
