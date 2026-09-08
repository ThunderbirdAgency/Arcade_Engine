// Ingest finished films: download (or copy) each result, probe it, extract its last frame for
// continuity chaining, and record everything in stories/<slug>/media.json with the prompt hash
// the film was made from. Films land in dist/games/<slug>/films/ (or the src the manifest already has).
import fs from 'node:fs';
import path from 'node:path';
import { probeMp4 } from './mp4.mjs';
import { extractFrames } from './frames.mjs';
import { loadMedia, saveMedia, defaultClipSrc, STORIES_DIR } from './compile.mjs';

async function fetchTo(url, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (url.startsWith('file:') || fs.existsSync(url)) { fs.copyFileSync(url.replace(/^file:\/\//, ''), file); return; }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/**
 * results: [{ id: 'film:gate-win', jobId, url|file, model? }] — ids match pack ids.
 * shots: compiled shots.json (for hashes and durations).
 */
export async function ingest(slug, shots, results, { distDir = 'dist', frames = true } = {}) {
  const media = loadMedia(slug);
  media.clips ||= {};
  const report = [];
  for (const r of results) {
    if (!r.id?.startsWith('film:')) continue;
    const clip = r.id.slice(5);
    const shot = shots.shots.find(s => s.clip === clip);
    if (!shot) { report.push({ clip, error: 'not in shots.json' }); continue; }
    const src = media.clips[clip]?.src || defaultClipSrc(slug, clip);
    const file = path.join(distDir, src);
    await fetchTo(r.url || r.file, file);
    const probe = probeMp4(file);
    const entry = {
      ...(media.clips[clip] || {}),
      src, provider: r.provider || shots.production.provider, model: r.model || shots.production.model,
      jobId: r.jobId || null, sourceUrl: r.url || null, hash: shot.hash,
      duration: probe.duration, width: probe.width, height: probe.height, bytes: probe.bytes, fastStart: probe.fastStart,
      generated: new Date().toISOString().slice(0, 10),
      review: { status: 'pending' },
    };
    const problems = [];
    if (!probe.duration) problems.push('could not read duration');
    if (probe.fastStart === false) problems.push('moov atom is after mdat (no fast start): the film will not stream well');
    if (shot.duration && probe.duration && Math.abs(probe.duration - shot.duration) > 1.5) problems.push(`duration ${probe.duration}s differs from the planned ${shot.duration}s`);
    if (frames) {
      try {
        const out = await extractFrames(file, ['last'], path.join(STORIES_DIR, slug, 'frames'), { duration: probe.duration });
        entry.lastFrame = path.relative(process.cwd(), out[0].file);
      } catch (e) { problems.push(`last frame not extracted: ${e.message}`); }
    }
    media.clips[clip] = entry;
    report.push({ clip, duration: probe.duration, size: `${probe.width}x${probe.height}`, problems });
  }
  saveMedia(slug, media);
  return report;
}
