// Job pack: turns shots.json into provider-ready generation requests, staged so that
// pre-production assets (character sheets, location keyframes) come before films, and
// films that chain from another film's last frame come after their parent.
import { promptHash } from './prompts.mjs';

const IMAGE_MODEL_DEFAULT = 'nano_banana_pro';

/** Placeholders resolved at submission time by the provider or the session operator. */
export const ref = {
  keyframe: id => `{{keyframe:${id}}}`,
  sheet: id => `{{sheet:${id}}}`,
  clipFrame: (clip, frame) => `{{clip:${clip}:${frame}}}`,
  clipJob: clip => `{{job:${clip}}}`,
};

export function buildPack(shots, media = { clips: {} }, { only = null, includeReady = false } = {}) {
  const p = shots.production || {};
  const cont = p.continuity || {};
  const stages = { assets: [], films: [] };

  // Stage 1: assets. Keyframes for every location without one; sheets for characters without a sheet or element.
  for (const a of shots.assets) {
    if (a.kind === 'keyframe' && !a.have) stages.assets.push({
      id: `keyframe:${a.id}`, kind: 'keyframe', target: a.id, tool: 'generate_image',
      params: { model: p.imageModel || IMAGE_MODEL_DEFAULT, prompt: a.prompt, aspect_ratio: p.aspect || '16:9' },
      saveAs: `keyframes/${a.id}.webp`,
    });
    if (a.kind === 'character-sheet' && !a.have && !a.element) stages.assets.push({
      id: `sheet:${a.id}`, kind: 'character-sheet', target: a.id, tool: 'generate_image',
      params: { model: p.imageModel || IMAGE_MODEL_DEFAULT, prompt: a.prompt, aspect_ratio: '3:4' },
      saveAs: `sheets/${a.id}.webp`, then: 'show_reference_elements(action=create) → characters.<id>.element',
    });
  }

  // Stage 2: films.
  const wanted = shots.shots.filter(s => (!only || only.includes(s.clip)) && (includeReady || s.status !== 'ready'));
  const order = topo(wanted, shots.shots);
  for (const s of order) {
    const medias = [];
    const sf = s.startFrom || {};
    if (sf.clip) medias.push({ role: 'start_image', value: ref.clipFrame(sf.clip, sf.frame || 'last') });
    else if (sf.location) medias.push({ role: 'start_image', value: ref.keyframe(sf.location) });
    if (cont.characterReferences) for (const c of s.cast) medias.push({ role: 'image_references', value: ref.sheet(String(c).split('@')[0]) });
    if (cont.videoReference && sf.clip) medias.push({ role: 'video_references', value: ref.clipJob(sf.clip) });
    const params = {
      model: p.model, mode: p.mode || 'omni_reference', prompt: s.prompt, medias,
      duration: s.duration, resolution: p.resolution || '1080p', aspect_ratio: p.aspect || '16:9',
      generate_audio: p.audio !== false,
    };
    if (p.bitrate) params.bitrate_mode = p.bitrate;
    stages.films.push({
      id: `film:${s.clip}`, kind: 'film', clip: s.clip, nodeId: s.nodeId, hash: s.hash, status: s.status,
      dependsOn: sf.clip ? [`film:${sf.clip}`] : [],
      tool: 'generate_video_batch', params, saveAs: `films/${s.clip}.mp4`,
      verify: verifyChecklist(shots, s),
    });
  }
  return { slug: shots.slug, provider: p.provider || 'higgsfield-session', model: p.model, created: new Date().toISOString().slice(0, 10), stages, placeholders: PLACEHOLDER_DOC };
}

/** Order films so that a clip chained from another comes after it. Ready parents are not re-added. */
function topo(wanted, all) {
  const byClip = new Map(all.map(s => [s.clip, s]));
  const out = [], seen = new Set();
  const visit = s => {
    if (seen.has(s.clip)) return;
    seen.add(s.clip);
    const parent = s.startFrom?.clip && byClip.get(s.startFrom.clip);
    if (parent && wanted.includes(parent)) visit(parent);
    out.push(s);
  };
  wanted.forEach(visit);
  return out;
}

/** What a reviewer (human or model) must confirm before a film is approved. */
export function verifyChecklist(shots, s) {
  const list = [];
  for (const c of s.cast) { const [id, state] = String(c).split('@'); const ch = shots.characters[id]; if (ch) list.push(`${ch.name || id} appears and matches: ${state ? ch.states?.[state] : ch.description}.`); }
  const loc = shots.locations[s.location]; if (loc) list.push(`Setting matches: ${loc.description}.`);
  list.push('No titles, lettering, subtitles, UI, watermark or readable text anywhere in frame.');
  list.push('One continuous shot with genuine character action (not a still with a camera move).');
  if (s.kind === 'scene') list.push('The danger or choice is readable before the move window opens, and the film ends on suspense without resolving it.');
  if (s.kind === 'death') list.push('The setback is comic and harmless: no injury, blood or gore. Ends on a held pose.');
  if (s.kind === 'cut') list.push('The outcome is unambiguous and ends with the character positioned for the next scene.');
  return list;
}

const PLACEHOLDER_DOC = {
  '{{keyframe:<location>}}': 'media_id of the location keyframe (upload dist keyframe via media_import_url, or the job id of the keyframe generated in the assets stage).',
  '{{sheet:<character>}}': 'job id or media_id of the character sheet image, or omit when characters.<id>.element is used inline as <<<element_id>>>.',
  '{{clip:<clip>:last}}': 'media_id of the last frame of that film (ingest extracts it to stories/<slug>/frames/<clip>-last.png when ffmpeg is available).',
  '{{job:<clip>}}': 'the provider job id of that film, from media.json.',
};

export const hashOf = promptHash;
