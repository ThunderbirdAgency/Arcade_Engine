// Stitch the golden path (every correct move) into one MP4 for continuity checks and trailers.
// Needs ffmpeg with H.264 support on PATH; otherwise prints the concat list so it can run elsewhere.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadMedia, STORIES_DIR } from './compile.mjs';
import { walk, firstCorrect, clipOf } from '../engine/graph.mjs';

export function goldenClips(story) {
  const path_ = walk({ nodes: story.nodes, start: story.start }, firstCorrect);
  return path_.map(id => clipOf(story.nodes[id], id)).filter(Boolean);
}

export function stitch(story, { distDir = 'dist', out = null } = {}) {
  const media = loadMedia(story.slug);
  const clips = goldenClips(story);
  const files = clips.map(c => media.clips?.[c]?.src && path.join(distDir, media.clips[c].src));
  const missing = clips.filter((c, i) => !files[i] || !fs.existsSync(files[i]));
  if (missing.length) return { ok: false, clips, missing };
  const listFile = path.join(STORIES_DIR, story.slug, 'golden-path.txt');
  fs.writeFileSync(listFile, files.map(f => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const target = out || path.join(STORIES_DIR, story.slug, 'golden-path.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', target], { stdio: 'inherit' });
  if (r.error || r.status !== 0) return { ok: false, clips, listFile, note: 'ffmpeg with H.264 support is needed to render; the concat list was written' };
  return { ok: true, clips, out: target };
}
