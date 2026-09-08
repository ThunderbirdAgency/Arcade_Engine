// ArcadeEngine runtime core: a pure state machine with no DOM or video dependency.
// The player (engine/player.mjs) feeds it clip events and inputs, and renders the effects it returns.
// This keeps the entire game logic testable in Node with a fake clock.
import { STANDARD_MOVES, clipOf, nextClips } from './graph.mjs';

const DEFAULT_RULES = { lives: 3, scoring: { move: 100, scene: 250, ending: 1000 }, earlyIsWrong: false, checkpoints: 'scene' };

/** Resolve a beat's move table into display specs: { id, label, key, icon, correct }. */
export function beatMoves(beat) {
  const out = [];
  const seen = new Set();
  const add = (id, spec = {}, correct) => {
    const key = spec.key || id;
    const std = STANDARD_MOVES[key];
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, key, label: spec.label || std?.label || id, icon: spec.icon || std?.icon || '•', keys: spec.keys || [], correct });
  };
  for (const [id, spec] of Object.entries(beat.moves || {})) add(id, spec, true);
  for (const id of beat.show || []) add(id, beat.decoys?.[id] || {}, false);
  for (const [id, spec] of Object.entries(beat.decoys || {})) add(id, spec, false);
  return out;
}

/** Map a keyboard key (lowercased) to a move id for the given beat. */
export function moveForKey(beat, key) {
  for (const m of beatMoves(beat)) {
    const std = STANDARD_MOVES[m.key];
    if (std?.keys.includes(key) || m.keys.includes(key)) return m.id;
    if (m.key === key) return m.id;
  }
  return null;
}

export function createEngine(game, { mode = 'arcade' } = {}) {
  const rules = { ...DEFAULT_RULES, ...(game.rules || {}), scoring: { ...DEFAULT_RULES.scoring, ...(game.rules?.scoring || {}) } };
  const s = {
    mode, phase: 'title', nodeId: null, clip: null, lives: rules.lives, score: 0,
    beat: -1, beatOpen: 0, beatClose: 0, cueShown: false, duration: 0, checkpoint: null,
    deaths: 0, moves: 0, hits: 0, visited: [], recap: [], pendingText: null,
  };
  const node = () => game.nodes[s.nodeId];
  const fx = [];
  const emit = e => { fx.push(e); return e; };
  const flush = () => fx.splice(0);
  const hud = () => emit({ type: 'hud', lives: s.lives, score: s.score, nodeId: s.nodeId, chapter: node()?.chapter ?? s.lastChapter });

  function enter(id) {
    const n = game.nodes[id];
    if (!n) throw new Error(`Unknown node: ${id}`);
    s.nodeId = id;
    s.visited.push(id);
    if (n.chapter) s.lastChapter = n.chapter;
    if (n.recap && n.type !== 'scene') s.recap.push(n.recap);
    s.beat = -1; s.cueShown = false; s.duration = 0; s.pendingText = null;
    if (n.type === 'scene' && (n.checkpoint || rules.checkpoints === 'scene')) s.checkpoint = id;
    hud();
    switch (n.type) {
      case 'card': s.phase = 'overlay'; emit({ type: 'card', node: n, nodeId: id }); break;
      case 'ending':
        if (n.clip) { s.phase = 'loading'; s.clip = n.clip; emit({ type: 'play', clip: n.clip, nodeId: id, kind: 'ending' }); }
        else finishEnding();
        break;
      default:
        s.phase = 'loading'; s.clip = clipOf(n, id);
        emit({ type: 'play', clip: s.clip, nodeId: id, kind: n.type });
        emit({ type: 'prefetch', clips: nextClips(game, id) });
    }
  }

  function finishEnding() {
    const n = node();
    s.phase = 'ending';
    s.score += rules.scoring.ending;
    hud();
    emit({ type: 'ending', node: n, nodeId: s.nodeId, summary: summary() });
  }

  function summary() {
    return { score: s.score, lives: s.lives, deaths: s.deaths, moves: s.moves, hits: s.hits, recap: [...s.recap], visited: [...s.visited] };
  }

  function armBeat(i) {
    const n = node();
    const beat = n.beats[i];
    s.beat = i; s.cueShown = false;
    const [open, close] = beat.at;
    const abs = beat.unit === 'seconds';
    s.beatOpen = abs ? open : open * s.duration;
    s.beatClose = mode === 'guided' ? Infinity : (abs ? close : close * s.duration);
  }

  function resolveBeat(verdict, moveId) {
    const n = node();
    const beat = n.beats[s.beat];
    emit({ type: 'cueOff' });
    emit({ type: 'judge', verdict, move: moveId, beat: s.beat, nodeId: s.nodeId });
    if (verdict === 'hit') {
      s.hits++; s.score += rules.scoring.move; hud();
      const to = beat.moves[moveId].to;
      if (to) { s.beatDone = true; emit({ type: 'cut' }); leaveScene(to); return; }
      // Keep the film rolling; arm the next beat or wait for the clip to end.
      if (s.beat + 1 < n.beats.length) armBeat(s.beat + 1); else s.beat = n.beats.length;
      return;
    }
    const target = (verdict === 'wrong' && beat.wrong?.[moveId]) || beat.miss || n.miss;
    if (!target) throw new Error(`Scene ${s.nodeId} beat ${s.beat} has no miss target`);
    emit({ type: 'cut' });
    leaveScene(target);
  }

  function leaveScene(to) {
    const n = node();
    if (n.type === 'scene' && game.nodes[to]?.type !== 'death') {
      // Scene cleared: award the bonus and log the recap line once, however many retries it took.
      s.score += rules.scoring.scene;
      if (n.recap) s.recap.push(n.recap);
      hud();
    }
    enter(to);
  }

  const api = {
    get state() { return { ...s }; },
    game, rules,

    /** Begin a new run from the start node. */
    start() {
      Object.assign(s, { phase: 'title', lives: rules.lives, score: 0, deaths: 0, moves: 0, hits: 0, visited: [], recap: [], checkpoint: null, lastChapter: null });
      enter(game.start);
      return flush();
    },

    /** The player reports that the current clip is ready and how long it is. */
    clipLoaded(duration) {
      if (s.phase !== 'loading') return flush();
      s.duration = duration;
      const n = node();
      s.phase = 'playing';
      if (n.type === 'scene' && n.beats?.length) armBeat(0); else s.beat = 0;
      return flush();
    },

    /** Playback clock, in seconds from the start of the clip. */
    tick(t) {
      if (s.phase !== 'playing') return flush();
      const n = node();
      if (n.type !== 'scene' || s.beat < 0 || s.beat >= n.beats.length) return flush();
      const beat = n.beats[s.beat];
      if (!s.cueShown && t >= s.beatOpen) {
        s.cueShown = true;
        emit({ type: 'cue', beat, index: s.beat, moves: beatMoves(beat), open: s.beatOpen, close: s.beatClose, hold: mode === 'guided' });
      }
      if (s.cueShown && mode !== 'guided') {
        const left = Math.max(0, (s.beatClose - t) / Math.max(0.001, s.beatClose - s.beatOpen));
        emit({ type: 'timer', left });
        if (t > s.beatClose) resolveBeat('miss', null);
      }
      return flush();
    },

    /** The player pressed a move. */
    input(moveId) {
      if (s.phase !== 'playing') return flush();
      const n = node();
      if (n.type !== 'scene' || s.beat < 0 || s.beat >= n.beats.length) return flush();
      const beat = n.beats[s.beat];
      if (!s.cueShown) {
        if (rules.earlyIsWrong) { s.moves++; s.cueShown = true; resolveBeat('wrong', moveId); }
        else emit({ type: 'early' });
        return flush();
      }
      s.moves++;
      resolveBeat(beat.moves?.[moveId] ? 'hit' : 'wrong', moveId);
      return flush();
    },

    /** The current clip finished playing. */
    clipEnded() {
      if (s.phase !== 'playing') return flush();
      const n = node();
      switch (n.type) {
        case 'scene': {
          if (s.beat >= 0 && s.beat < n.beats.length) {
            // The film ran out during an open beat: that is a miss.
            if (!s.cueShown) s.cueShown = true;
            resolveBeat('miss', null);
            break;
          }
          if (!n.next) throw new Error(`Scene ${s.nodeId} ended with no next node`);
          leaveScene(n.next);
          break;
        }
        case 'cut':
          if (n.text) { s.phase = 'overlay'; emit({ type: 'text', node: n, nodeId: s.nodeId }); }
          else enter(n.next);
          break;
        case 'death': {
          s.deaths++;
          if (mode === 'arcade') s.lives = Math.max(0, s.lives - 1);
          hud();
          s.phase = 'overlay';
          if (s.lives === 0 && mode === 'arcade') emit({ type: 'gameover', node: n, nodeId: s.nodeId, summary: summary() });
          else emit({ type: 'death', node: n, nodeId: s.nodeId, retry: n.retry || s.checkpoint, lives: s.lives });
          break;
        }
        case 'ending': finishEnding(); break;
      }
      return flush();
    },

    /** Dismiss the current overlay (card, text, death) and continue. */
    advance() {
      if (s.phase !== 'overlay') return flush();
      const n = node();
      if (n.type === 'card') enter(n.next);
      else if (n.type === 'cut') enter(n.next);
      else if (n.type === 'death') {
        if (s.lives === 0 && mode === 'arcade') return flush();
        enter(n.retry || s.checkpoint || game.start);
      }
      return flush();
    },

    /** Switch to guided practice for the checkpoint after a game over. */
    practice() {
      mode = 'guided'; s.mode = 'guided'; s.lives = rules.lives;
      enter(s.checkpoint || game.start);
      return flush();
    },

    summary,
  };
  return api;
}
