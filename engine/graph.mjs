// Graph utilities shared by the runtime core, the compiler and the tests.
// A compiled game is { slug, title, rules, start, nodes, clips }.
// Nodes: scene | cut | death | card | ending. See docs/STORY-FORMAT.md.

export const STANDARD_MOVES = {
  up:     { label: 'Up',     icon: '↑', keys: ['arrowup', 'w'] },
  down:   { label: 'Down',   icon: '↓', keys: ['arrowdown', 's'] },
  left:   { label: 'Left',   icon: '←', keys: ['arrowleft', 'a'] },
  right:  { label: 'Right',  icon: '→', keys: ['arrowright', 'd'] },
  action: { label: 'Action', icon: '✦', keys: [' ', 'enter', 'e'] },
};

export const NODE_TYPES = ['scene', 'cut', 'death', 'card', 'ending'];

/** Every edge leaving a node, tagged by kind. */
export function edgesOf(node) {
  const out = [];
  const push = (to, kind, via) => { if (to) out.push({ to, kind, via }); };
  switch (node.type) {
    case 'scene':
      for (const [i, beat] of (node.beats || []).entries()) {
        for (const [move, spec] of Object.entries(beat.moves || {})) push(spec?.to, 'hit', { beat: i, move });
        push(beat.miss || node.miss, 'miss', { beat: i });
        for (const [move, to] of Object.entries(beat.wrong || {})) push(to, 'wrong', { beat: i, move });
      }
      push(node.next, 'next');
      break;
    case 'cut': case 'card': push(node.next, 'next'); break;
    case 'death': push(node.retry, 'retry'); break;
    case 'ending': break;
  }
  return out;
}

/** Scenes and cards that can lead directly into a node (used to resolve implicit death retries). */
export function predecessors(game, target) {
  const out = [];
  for (const [id, node] of Object.entries(game.nodes)) if (edgesOf(node).some(e => e.to === target)) out.push(id);
  return out;
}

/**
 * Edges with implicit retries resolved: a death with no explicit `retry` returns to the
 * checkpoint, which in practice is whichever scene led into it.
 */
export function resolvedEdges(game, id) {
  const node = game.nodes[id];
  const edges = edgesOf(node);
  if (node.type === 'death' && !node.retry) for (const p of predecessors(game, id)) edges.push({ to: p, kind: 'retry', via: { implicit: true } });
  return edges;
}

/** Nodes reachable from start following every edge. */
export function reachable(game, from = game.start) {
  const seen = new Set();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id) || !game.nodes[id]) continue;
    seen.add(id);
    for (const e of resolvedEdges(game, id)) stack.push(e.to);
  }
  return seen;
}

/** Ids of nodes from which an ending is reachable (reverse search). */
export function canReachEnding(game) {
  const rev = new Map();
  for (const id of Object.keys(game.nodes)) for (const e of resolvedEdges(game, id)) {
    if (!rev.has(e.to)) rev.set(e.to, new Set());
    rev.get(e.to).add(id);
  }
  const ok = new Set();
  const stack = Object.entries(game.nodes).filter(([, n]) => n.type === 'ending').map(([id]) => id);
  while (stack.length) {
    const id = stack.pop();
    if (ok.has(id)) continue;
    ok.add(id);
    for (const p of rev.get(id) || []) stack.push(p);
  }
  return ok;
}

/** Clip id a node plays (nodes default to their own id). */
export function clipOf(node, id) {
  if (node.type === 'card') return null;
  if (node.type === 'ending' && !node.clip) return null;
  return node.clip || id;
}

/** Clips that might play immediately after this node (for prefetching). */
export function nextClips(game, id) {
  const out = new Set();
  for (const e of resolvedEdges(game, id)) {
    const n = game.nodes[e.to];
    if (!n) continue;
    const c = clipOf(n, e.to);
    if (c) out.add(c);
    else if (n.type === 'card' && n.next && game.nodes[n.next]) { const c2 = clipOf(game.nodes[n.next], n.next); if (c2) out.add(c2); }
  }
  return [...out];
}

/**
 * Walk the game with a policy. policy(node, beat, index) returns the move id to press
 * (or null to let the beat time out). Returns the ordered list of visited node ids.
 * Used by verify to prove the golden path and by tests.
 */
export function walk(game, policy, { from = game.start, limit = 500 } = {}) {
  const path = [];
  let id = from, checkpoint = null;
  while (id && path.length < limit) {
    const node = game.nodes[id];
    if (!node) throw new Error(`walk: unknown node ${id}`);
    path.push(id);
    if (node.type === 'ending') break;
    if (node.type === 'cut' || node.type === 'card') { id = node.next; continue; }
    if (node.type === 'death') { id = node.retry || checkpoint; continue; }
    checkpoint = id;
    let next = node.next;
    for (const [i, beat] of (node.beats || []).entries()) {
      const move = policy(node, beat, i);
      if (move == null) { next = beat.miss || node.miss; break; }
      if (beat.moves?.[move]) { if (beat.moves[move].to) { next = beat.moves[move].to; break; } continue; }
      next = beat.wrong?.[move] || beat.miss || node.miss; break;
    }
    id = next;
  }
  return path;
}

/** The first correct move of a beat (deterministic golden path). */
export const firstCorrect = (node, beat) => Object.keys(beat.moves || {})[0] ?? null;
