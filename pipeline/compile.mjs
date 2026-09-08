// story.mjs (+ media.json) → game.json for the runtime and shots.json for production.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { clipOf, walk, firstCorrect } from '../engine/graph.mjs';
import { lintStory } from './lint.mjs';
import { buildPrompt, promptHash, characterSheetPrompt, keyframePrompt } from './prompts.mjs';

export const STORIES_DIR = path.resolve('stories');

export function listStories() {
  if (!fs.existsSync(STORIES_DIR)) return [];
  return fs.readdirSync(STORIES_DIR).filter(d => fs.existsSync(path.join(STORIES_DIR, d, 'story.mjs')));
}

export async function loadStory(slug) {
  const file = path.join(STORIES_DIR, slug, 'story.mjs');
  if (!fs.existsSync(file)) throw new Error(`No story at ${file}`);
  const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
  const story = mod.default;
  if (story.slug !== slug) throw new Error(`stories/${slug}/story.mjs declares slug "${story.slug}"`);
  return story;
}

export function loadMedia(slug) {
  const file = path.join(STORIES_DIR, slug, 'media.json');
  if (!fs.existsSync(file)) return { version: 2, clips: {} };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function saveMedia(slug, media) {
  fs.writeFileSync(path.join(STORIES_DIR, slug, 'media.json'), JSON.stringify(media, null, 2) + '\n');
}

/** Default public path for a story's film. */
export const defaultClipSrc = (slug, clip) => `/games/${slug}/films/${clip}.mp4`;

/**
 * Compile a story. Throws on lint errors unless { allowErrors }.
 * Returns { game, shots, lint, status }.
 */
export function compileStory(story, media = { clips: {} }, { distDir = 'dist' } = {}) {
  const lint = lintStory(story);
  const production = story.production || {};
  const nodes = {};
  const shots = [];
  const clips = {};
  const missing = [];
  const drifted = [];

  for (const [id, n] of Object.entries(story.nodes)) {
    const out = { type: n.type };
    for (const k of ['chapter', 'text', 'next', 'retry', 'miss', 'recap', 'checkpoint']) if (n[k] !== undefined) out[k] = n[k];
    if (n.location && story.locations?.[n.location]?.keyframe) out.poster = story.locations[n.location].keyframe;
    if (n.type === 'scene') out.beats = n.beats.map(b => {
      const beat = { at: b.at, cue: b.cue, moves: {}, decoys: {} };
      if (b.unit) beat.unit = b.unit;
      if (b.miss) beat.miss = b.miss;
      if (b.wrong) beat.wrong = b.wrong;
      for (const [m, spec] of Object.entries(b.moves || {})) beat.moves[m] = { ...spec };
      for (const [m, spec] of Object.entries(b.decoys || {})) beat.decoys[m] = { ...spec };
      return beat;
    });
    const clip = clipOf(n, id);
    if (clip) {
      out.clip = clip;
      const prompt = buildPrompt(story, id, n);
      const hash = promptHash(prompt, production);
      const entry = media.clips?.[clip];
      const shot = {
        clip, nodeId: id, kind: n.type, location: n.location, cast: n.cast || [],
        prompt, hash, duration: n.duration || production.duration,
        startFrom: n.startFrom || (production.continuity?.startFrame === 'previous' ? previousClipFor(story, id) : null) || { location: n.location },
        status: !entry?.src ? 'missing' : entry.hash && entry.hash !== hash ? 'drifted' : 'ready',
      };
      shots.push(shot);
      if (entry?.src) {
        clips[clip] = { src: entry.src, duration: entry.duration ?? null };
        if (entry.review?.status) clips[clip].review = entry.review.status;
        if (shot.status === 'drifted') drifted.push(clip);
        // Films exist in dist; make sure the file is really there when the src is local.
        if (entry.src.startsWith('/') && !fs.existsSync(path.join(distDir, entry.src))) missing.push(clip);
      } else missing.push(clip);
    }
    nodes[id] = out;
  }

  const assets = [];
  for (const [id, c] of Object.entries(story.characters || {})) assets.push({ kind: 'character-sheet', id, prompt: characterSheetPrompt(story, id), have: c.sheet || null, element: c.element || null });
  for (const [id, l] of Object.entries(story.locations || {})) assets.push({ kind: 'keyframe', id, prompt: keyframePrompt(story, id), have: l.keyframe && fs.existsSync(path.join(distDir, l.keyframe)) ? l.keyframe : null });

  const golden = walk({ nodes: story.nodes, start: story.start }, firstCorrect);
  const game = {
    format: 2, slug: story.slug, title: story.title, episode: story.episode, tagline: story.tagline, description: story.description,
    poster: story.locations?.[story.poster]?.keyframe || story.poster || null, disclaimer: story.disclaimer || null,
    rules: story.rules || {}, start: story.start, nodes, clips, links: story.links || [],
    playable: missing.length === 0 && lint.errors.length === 0,
  };
  const status = { missing, drifted, shots: shots.length, ready: shots.filter(s => s.status === 'ready').length, golden };
  return { game, shots: { slug: story.slug, production, style: story.style, characters: story.characters || {}, locations: story.locations || {}, assets, shots }, lint, status };
}

/** For continuity chaining: the clip most likely to precede this node on the golden path. */
function previousClipFor(story, id) {
  const nodes = story.nodes;
  for (const [pid, p] of Object.entries(nodes)) {
    if (p.next === id) { const c = clipOf(p, pid); if (c) return { clip: c, frame: 'last' }; }
    for (const b of p.beats || []) for (const spec of Object.values(b.moves || {})) if (spec.to === id) { const c = clipOf(p, pid); if (c) return { clip: c, frame: 'last' }; }
  }
  return null;
}

/** Write game.json + shots.json for a slug into dist and the story folder. */
export async function compileToDisk(slug, { distDir = 'dist' } = {}) {
  const story = await loadStory(slug);
  const media = loadMedia(slug);
  const result = compileStory(story, media, { distDir });
  const gameDir = path.join(distDir, 'games', slug);
  fs.mkdirSync(gameDir, { recursive: true });
  fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify(result.game));
  fs.writeFileSync(path.join(STORIES_DIR, slug, 'shots.json'), JSON.stringify(result.shots, null, 2) + '\n');
  return result;
}
