// Continuity and structure linter for stories. Returns { errors, warnings } with rule ids so
// authors can search for them in docs/STORY-FORMAT.md.
import { NODE_TYPES, STANDARD_MOVES, edgesOf, reachable, canReachEnding, clipOf } from '../engine/graph.mjs';
import { resolveCast } from './prompts.mjs';

export function lintStory(story) {
  const errors = [], warnings = [];
  const err = (rule, msg) => errors.push({ rule, msg });
  const warn = (rule, msg) => warnings.push({ rule, msg });
  const nodes = story.nodes || {};

  // S1 identity
  if (!/^[a-z0-9-]+$/.test(story.slug || '')) err('S1', 'story.slug must be lowercase letters, digits and dashes');
  if (!story.title) err('S1', 'story.title is required');
  if (!story.start || !nodes[story.start]) err('S2', `story.start must name a node (got ${story.start})`);
  if (!story.style?.look) err('S3', 'style.look is required: the visual bible every prompt starts with');
  if (!story.production?.model) warn('S4', 'production.model missing; shots will not carry a model');

  // N* node structure
  for (const [id, n] of Object.entries(nodes)) {
    if (!/^[a-z0-9-]+$/.test(id)) err('N1', `node id "${id}" must be lowercase letters, digits and dashes (it becomes a file name)`);
    if (!NODE_TYPES.includes(n.type)) { err('N2', `node ${id}: unknown type "${n.type}"`); continue; }
    for (const e of edgesOf(n)) if (!nodes[e.to]) err('N3', `node ${id}: ${e.kind} edge points to missing node "${e.to}"`);
    if (['scene', 'cut', 'death'].includes(n.type) || (n.type === 'ending' && n.clip)) {
      if (!n.shot?.action && !n.clip) err('N4', `node ${id}: needs shot.action (what the film shows) or an explicit clip id`);
      if (!n.location) err('C1', `node ${id}: location is required for a filmed node`);
      else if (!story.locations?.[n.location]) err('C1', `node ${id}: unknown location "${n.location}"`);
      for (const c of n.cast || []) {
        const r = resolveCast(story, c);
        if (!r.character) err('C2', `node ${id}: unknown character "${r.id}"`);
        else if (r.state && !r.description) err('C3', `node ${id}: character "${r.id}" has no state "${r.state}" in characters.${r.id}.states`);
      }
      if (n.shot?.action && /\b(subtitle|caption|logo|watermark)\b/i.test(n.shot.action)) warn('C4', `node ${id}: shot.action mentions on-screen text; generated films should carry no lettering`);
    }
    if (n.type === 'scene') {
      if (!n.beats?.length) err('B1', `scene ${id}: needs at least one beat`);
      let lastClose = -1;
      for (const [i, b] of (n.beats || []).entries()) {
        const tag = `scene ${id} beat ${i}`;
        if (!Array.isArray(b.at) || b.at.length !== 2) { err('B2', `${tag}: at must be [open, close]`); continue; }
        const [o, c] = b.at;
        const seconds = b.unit === 'seconds';
        if (!(o >= 0 && c > o)) err('B2', `${tag}: window must satisfy 0 <= open < close`);
        if (!seconds && c > 1) err('B2', `${tag}: fractional window exceeds 1 (use unit:'seconds' for absolute times)`);
        if (seconds && story.production?.duration && c > story.production.duration) err('B2', `${tag}: window closes after the ${story.production.duration}s clip`);
        if (o < lastClose) err('B3', `${tag}: overlaps the previous beat`);
        lastClose = c;
        const span = seconds ? c - o : (c - o) * (story.production?.duration || 6);
        if (span < 0.35) warn('B4', `${tag}: reaction window is ${span.toFixed(2)}s; under 0.35s is brutal even for arcade mode`);
        if (!b.cue) err('B5', `${tag}: cue text is required (it is what the player reads)`);
        const moves = Object.keys(b.moves || {});
        if (!moves.length) err('B6', `${tag}: needs at least one correct move`);
        const keys = new Set();
        for (const [mid, spec] of Object.entries({ ...(b.moves || {}), ...(b.decoys || {}) })) {
          const key = spec?.key || mid;
          if (!STANDARD_MOVES[key]) err('B7', `${tag}: move "${mid}" needs key to be one of ${Object.keys(STANDARD_MOVES).join('/')}`);
          if (keys.has(key)) err('B8', `${tag}: two moves share the key "${key}"`);
          keys.add(key);
        }
        for (const mid of Object.keys(b.wrong || {})) if (b.moves?.[mid]) err('B9', `${tag}: "${mid}" is both a correct move and a wrong move`);
        if (!(b.miss || n.miss)) err('B10', `${tag}: no miss target (beat.miss or scene.miss) for timeouts and wrong moves`);
        const missTarget = nodes[b.miss || n.miss];
        if (missTarget && missTarget.type !== 'death') warn('B11', `${tag}: miss target "${b.miss || n.miss}" is a ${missTarget.type}, not a death; the player will not lose a life`);
        for (const [mid, to] of Object.entries(b.wrong || {})) if (nodes[to] && nodes[to].type !== 'death') warn('B11', `${tag}: wrong-move target "${to}" for "${mid}" is not a death`);
        const last = i === (n.beats.length - 1);
        if (last && !n.next && moves.some(m => !b.moves[m].to)) err('B12', `scene ${id}: last beat keeps the film rolling but scene.next is missing`);
      }
    }
    if (n.type === 'death') {
      if (!n.text?.title) warn('T1', `death ${id}: no text.title; the player will see a blank setback card`);
      const r = n.retry && nodes[n.retry];
      if (n.retry && r && r.type !== 'scene' && r.type !== 'card' && r.type !== 'cut') err('D1', `death ${id}: retry must return to a scene, card or cut (got ${r.type})`);
    }
    if (n.type === 'card' && !n.text?.title) err('T2', `card ${id}: text.title is required`);
    if (n.type === 'ending' && !n.text?.title) warn('T1', `ending ${id}: no text.title`);
  }

  // G* graph
  if (nodes[story.start]) {
    const reach = reachable({ nodes, start: story.start });
    for (const id of Object.keys(nodes)) if (!reach.has(id)) warn('G1', `node ${id} is unreachable from start`);
    const ok = canReachEnding({ nodes });
    for (const id of reach) if (!ok.has(id)) err('G2', `node ${id} cannot reach any ending (dead end)`);
    if (!Object.values(nodes).some(n => n.type === 'ending')) err('G3', 'story has no ending node');
    // Deaths must return somewhere sensible: explicit retry, or a scene checkpoint exists upstream.
    const hasScene = Object.values(nodes).some(n => n.type === 'scene');
    if (!hasScene) err('G4', 'story has no scene node: nothing for the player to do');
  }

  // C5 location continuity across next edges: jumps between locations without a card or a declared transition.
  for (const [id, n] of Object.entries(nodes)) {
    if (!n.location) continue;
    for (const e of edgesOf(n)) {
      const m = nodes[e.to];
      if (!m?.location || m.location === n.location) continue;
      if (e.kind === 'retry') continue;
      if (n.transition || m.transition || m.type === 'card' || n.text) continue;
      warn('C5', `${id} → ${e.to} changes location (${n.location} → ${m.location}) with no card between and no transition flag; the cut will be abrupt`);
    }
  }

  // M* clip id collisions: two nodes claiming the same clip must be deliberate.
  const clipOwners = new Map();
  for (const [id, n] of Object.entries(nodes)) {
    const c = clipOf(n, id);
    if (!c) continue;
    const owner = clipOwners.get(c);
    if (owner && (!n.clip || !nodes[owner].clip)) err('M1', `clip "${c}" is claimed by both ${owner} and ${id}`);
    clipOwners.set(c, id);
  }

  return { errors, warnings };
}

export function formatLint({ errors, warnings }) {
  return [...errors.map(e => `  ✖ ${e.rule} ${e.msg}`), ...warnings.map(w => `  ⚠ ${w.rule} ${w.msg}`)].join('\n');
}
