// Deterministic prompt builder. Every film prompt is assembled from the world bible so that
// character descriptions, location descriptions and style rules are byte-identical across shots.

const join = parts => parts.filter(Boolean).map(s => String(s).trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');

/** Resolve a cast entry like 'knight' or 'knight@gold' into { id, state, character, description }. */
export function resolveCast(story, entry) {
  const [id, state] = String(entry).split('@');
  const character = story.characters?.[id];
  if (!character) return { id, state, character: null, description: null };
  const description = state ? character.states?.[state] : character.description;
  return { id, state, character, description };
}

export function buildPrompt(story, nodeId, node) {
  const cast = (node.cast || []).map(c => resolveCast(story, c));
  const location = story.locations?.[node.location];
  const descriptions = cast.map(c => c.description).filter(Boolean);
  const continuity = descriptions.length || location
    ? `Preserve exactly ${[...descriptions, location?.description].filter(Boolean).join(', ')} and the character proportions in the reference.`
    : '';
  const characterRules = cast.map(c => c.character?.rules).filter(Boolean).join(' ');
  const shot = node.shot || {};
  const timing = story.production?.duration ? `${story.production.duration}-second continuous shot.` : '';
  return join([
    story.style?.look,
    continuity,
    story.style?.rules,
    story.style?.safety,
    characterRules,
    timing,
    shot.action,
    shot.ends,
    shot.extra,
  ]);
}

export function promptHash() { return "browser"; }

/** Prompt for a character sheet still, used to create a reusable Higgsfield reference element. */
export function characterSheetPrompt(story, id) {
  const c = story.characters[id];
  return join([
    'Character reference sheet, three-quarter view, full body, neutral pose, plain parchment background, no text.',
    story.style?.look,
    `Subject: ${c.description}.`,
    c.rules,
  ]);
}

/** Prompt for a location keyframe still, used as the start image of the first shot in that location. */
export function keyframePrompt(story, id) {
  const l = story.locations[id];
  return join([
    'Establishing keyframe, wide shot, no characters, no text.',
    story.style?.look,
    `Location: ${l.description}.`,
    l.mood,
  ]);
}
