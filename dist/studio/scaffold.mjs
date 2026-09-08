// Turns a workshop brief (the answers from /studio) into a Markdown brief and a story object that lints clean.
// Runs in the browser and in Node. The story it builds is a deliberate first draft: one scene per beat,
// a win cut and a death per scene, in order, so the writer (or Claude) starts from something that already plays.

export const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'untitled';
const idify = (s, fallback) => slugify(s) || fallback;
const MOVES = ['left', 'right', 'up', 'down', 'action'];

/** The blank brief: every question the workshop asks. */
export function emptyBrief() {
  return {
    title: '', episode: '', tagline: '', logline: '', synopsis: '', audience: '', lesson: '',
    look: '', palette: '', tone: '', safety: 'Family cartoon: no blood, injury, gore or death; failures are comic setbacks.',
    duration: 6, resolution: '1080p', aspect: '16:9', lives: 3,
    characters: [{ name: '', description: '', rules: '' }],
    locations: [{ name: '', description: '' }],
    scenes: [{ title: '', location: '', cast: '', setup: '', danger: '', cue: '', move: 'left', moveLabel: '', win: '', wrongMove: 'right', wrongLabel: '', fail: '', lesson: '' }],
    endingTitle: '', endingBody: '', secretEnding: '',
    notes: '',
  };
}

export function briefToMarkdown(b) {
  const L = [];
  const h = (n, t) => L.push(`${'#'.repeat(n)} ${t}`, '');
  const p = t => { if (t) L.push(String(t).trim(), ''); };
  const kv = (k, v) => { if (v) L.push(`- **${k}:** ${String(v).trim()}`); };
  h(1, `${b.title || 'Untitled'} · story brief`);
  kv('Episode', b.episode); kv('Tagline', b.tagline); kv('Logline', b.logline); kv('Audience', b.audience); kv('Lesson / point', b.lesson);
  kv('Slug', slugify(b.title)); L.push('');
  h(2, 'Synopsis'); p(b.synopsis || '_(none yet)_');
  h(2, 'The look'); kv('Style', b.look); kv('Palette', b.palette); kv('Tone', b.tone); kv('Safety', b.safety);
  kv('Films', `${b.duration}s · ${b.resolution} · ${b.aspect}`); kv('Lives', b.lives); L.push('');
  h(2, 'Characters');
  for (const c of b.characters.filter(c => c.name)) { L.push(`### ${c.name}`, ''); kv('Locked description', c.description); kv('Rules', c.rules); L.push(''); }
  h(2, 'Places');
  for (const l of b.locations.filter(l => l.name)) { L.push(`### ${l.name}`, ''); kv('Locked description', l.description); L.push(''); }
  h(2, 'Scenes, in order');
  b.scenes.filter(s => s.title || s.setup).forEach((s, i) => {
    L.push(`### ${i + 1}. ${s.title || 'Scene'}`, '');
    kv('Where', s.location); kv('Who', s.cast); kv('What we see', s.setup); kv('The danger or choice', s.danger);
    kv('Cue shown to the player', s.cue); kv('Right move', `${s.move}${s.moveLabel ? ` (“${s.moveLabel}”)` : ''}`);
    kv('What happens on the right move', s.win); kv('Wrong move', `${s.wrongMove}${s.wrongLabel ? ` (“${s.wrongLabel}”)` : ''}`);
    kv('What happens on the wrong move', s.fail); kv('Lesson card', s.lesson); L.push('');
  });
  h(2, 'Endings'); kv('Main ending', b.endingTitle); p(b.endingBody); kv('Secret ending', b.secretEnding); L.push('');
  if (b.notes) { h(2, 'Notes'); p(b.notes); }
  return L.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Build a story object the engine accepts. Every field the writer left blank gets a visible TODO. */
export function briefToStory(b) {
  const slug = slugify(b.title);
  const todo = what => `TODO: ${what}`;
  const characters = {};
  for (const c of b.characters.filter(c => c.name)) characters[idify(c.name)] = { name: c.name, description: c.description || todo(`describe ${c.name}`), ...(c.rules ? { rules: c.rules } : {}) };
  const locations = {};
  for (const l of b.locations.filter(l => l.name)) locations[idify(l.name)] = { name: l.name, description: l.description || todo(`describe ${l.name}`), keyframe: `/games/${slug}/keyframes/${idify(l.name)}.webp` };
  if (!Object.keys(locations).length) locations.main = { name: 'the main location', description: todo('describe the location'), keyframe: `/games/${slug}/keyframes/main.webp` };
  if (!Object.keys(characters).length) characters.hero = { name: 'the hero', description: todo('describe the hero') };

  const scenes = b.scenes.filter(s => s.title || s.setup);
  const nodes = {};
  const ids = scenes.map((s, i) => idify(s.title, `scene-${i + 1}`));
  scenes.forEach((s, i) => {
    const id = ids[i];
    const location = Object.keys(locations).find(k => k === idify(s.location)) || Object.keys(locations)[0];
    const cast = (s.cast || '').split(/[,/]/).map(x => idify(x.trim())).filter(x => characters[x]);
    const castList = cast.length ? cast : [Object.keys(characters)[0]];
    const move = MOVES.includes(s.move) ? s.move : 'left';
    let wrong = MOVES.includes(s.wrongMove) ? s.wrongMove : 'right';
    if (wrong === move) wrong = MOVES.find(m => m !== move);
    const nextId = i + 1 < scenes.length ? ids[i + 1] : 'end';
    nodes[id] = {
      type: 'scene', chapter: `${roman(i + 1)} · ${(s.title || `Scene ${i + 1}`).toUpperCase()}`, location, cast: castList,
      shot: { action: s.setup || todo('what the film shows before the move'), ends: s.danger ? `End on suspense: ${s.danger}` : todo('how the film ends on suspense') },
      beats: [{ at: [0.5, 0.92], cue: s.cue || s.danger || todo('cue text'), moves: { [move]: { label: s.moveLabel || move, to: `${id}-win` } }, decoys: { [wrong]: { label: s.wrongLabel || wrong } }, miss: `${id}-fail` }],
      recap: s.win ? firstSentence(s.win) : `Cleared ${s.title || `scene ${i + 1}`}.`,
      ...(i > 0 && scenes[i - 1].location !== s.location ? { transition: true } : {}),
    };
    nodes[`${id}-win`] = {
      type: 'cut', location, cast: castList,
      shot: { action: s.win || todo('what happens on the right move'), ends: 'End with the character positioned for the next scene.' },
      text: { kicker: 'GOOD MOVE', title: s.title ? `${s.title}: cleared.` : 'Nicely played.', body: s.lesson || '' },
      next: nextId,
    };
    nodes[`${id}-fail`] = {
      type: 'death', location, cast: castList,
      shot: { action: s.fail || todo('the comic setback on the wrong move'), ends: 'Hold the embarrassed pose. No injury.' },
      text: { kicker: 'A SETBACK', title: s.fail ? firstSentence(s.fail) : 'Try a different move.', body: 'Watch the danger and choose again. Your checkpoint is right here.' },
      retry: id,
    };
  });
  if (!scenes.length) {
    nodes.opening = { type: 'scene', chapter: 'I · OPENING', location: Object.keys(locations)[0], cast: [Object.keys(characters)[0]], shot: { action: todo('first scene'), ends: todo('suspense') }, beats: [{ at: [0.5, 0.92], cue: todo('cue'), moves: { left: { label: 'Go left', to: 'opening-win' } }, decoys: { right: { label: 'Go right' } }, miss: 'opening-fail' }] };
    nodes['opening-win'] = { type: 'cut', location: Object.keys(locations)[0], cast: [Object.keys(characters)[0]], shot: { action: todo('win') }, next: 'end' };
    nodes['opening-fail'] = { type: 'death', location: Object.keys(locations)[0], cast: [Object.keys(characters)[0]], shot: { action: todo('fail') }, text: { kicker: 'A SETBACK', title: 'Try again.' }, retry: 'opening' };
  }
  nodes.end = { type: 'ending', text: { kicker: `${(b.episode || b.title || 'THE END').toUpperCase()} · COMPLETE`, title: b.endingTitle || todo('ending title'), body: b.endingBody || b.lesson || '' } };
  if (b.secretEnding) nodes['end-secret'] = { type: 'ending', text: { kicker: 'SECRET ENDING', title: b.secretEnding, body: '' } };

  return {
    slug, title: b.title || 'Untitled', episode: b.episode || 'EPISODE 01', tagline: b.tagline || '', description: b.logline || '',
    poster: Object.keys(locations)[0],
    style: {
      look: b.look || todo('visual bible: medium, line, paint, era, palette'),
      rules: 'Genuine character action, not a slideshow or camera zoom. One continuous shot, no cuts, no titles, no lettering, no UI, no subtitles, no dialogue. Synchronized Foley and orchestral score.',
      safety: b.safety || '',
    },
    production: { provider: 'higgsfield-session', model: 'seedance_2_5', mode: 'omni_reference', duration: Number(b.duration) || 6, resolution: b.resolution || '1080p', aspect: b.aspect || '16:9', audio: true, bitrate: 'high', continuity: { startFrame: 'previous', characterReferences: true, videoReference: true } },
    characters, locations,
    rules: { lives: Number(b.lives) || 3, scoring: { move: 100, scene: 250, ending: 1000 }, checkpoints: 'scene' },
    start: ids[0] || 'opening',
    nodes,
  };
}

export function storyToModule(story) {
  return `// ${story.title} · generated by the Polyester Publishing workshop on ${new Date().toISOString().slice(0, 10)}\n// Search for "TODO:" to find what still needs a writer. See docs/STORY-FORMAT.md.\nexport default ${JSON.stringify(story, null, 2)};\n`;
}

function roman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n - 1] || String(n); }
function firstSentence(s) { const m = String(s).trim().match(/^[^.!?]+[.!?]?/); return (m ? m[0] : String(s)).trim(); }
