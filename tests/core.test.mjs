import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, beatMoves, moveForKey } from '../engine/core.mjs';
import { walk, firstCorrect, reachable, canReachEnding, nextClips } from '../engine/graph.mjs';
import { compileStory } from '../pipeline/compile.mjs';
import credits from '../stories/credits-lair/story.mjs';
import lantern from '../stories/lantern-bridge/story.mjs';

const media = { clips: Object.fromEntries(['gate-threat', 'gate-win', 'gate-fail', 'merchant-threat', 'merchant-win', 'merchant-fail', 'dragon-threat', 'dragon-win', 'dragon-fail'].map(c => [c, { src: `/assets/films/${c}.mp4`, duration: 6.08 }])) };
const creditsGame = compileStory({ ...credits, nodes: mapClips(credits.nodes) }, media, { distDir: 'dist' }).game;
const lanternGame = compileStory(lantern, { clips: {} }, { distDir: 'dist' }).game;

// Credit's Lair scene nodes play the "-threat" films under the old naming; map them explicitly.
function mapClips(nodes) {
  const out = structuredClone(nodes);
  for (const id of ['gate', 'merchant', 'dragon']) out[id].clip = `${id}-threat`;
  return out;
}

const types = fx => fx.map(e => e.type);
const find = (fx, t) => fx.find(e => e.type === t);

/** Drive a scene clip: load, run the clock to the cue, press a move (or null to time out). */
function playScene(engine, move, { duration = 6.08 } = {}) {
  engine.clipLoaded(duration);
  let fx = [];
  for (let t = 0; t <= duration + 0.1; t += 0.05) {
    fx = engine.tick(t);
    if (find(fx, 'cue')) {
      if (move === null) continue;
      return engine.input(move);
    }
    if (find(fx, 'judge')) return fx;
  }
  return engine.clipEnded();
}

test('golden path clears Credit’s Lair with three hits and no deaths', () => {
  const e = createEngine(creditsGame);
  let fx = e.start();
  assert.equal(find(fx, 'play').clip, 'gate-threat');
  assert.deepEqual(find(fx, 'prefetch').clips.sort(), ['gate-fail', 'gate-win']);
  fx = playScene(e, 'left');
  assert.equal(find(fx, 'judge').verdict, 'hit');
  assert.equal(find(fx, 'play').clip, 'gate-win');
  e.clipLoaded(6.08); fx = e.clipEnded();
  assert.equal(find(fx, 'text').nodeId, 'gate-win');
  fx = e.advance();
  assert.equal(find(fx, 'play').clip, 'merchant-threat');
  fx = playScene(e, 'inspect');
  assert.equal(find(fx, 'play').clip, 'merchant-win');
  e.clipLoaded(6.08); e.clipEnded(); fx = e.advance();
  assert.equal(find(fx, 'play').clip, 'dragon-threat');
  fx = playScene(e, 'duck');
  assert.equal(find(fx, 'play').clip, 'dragon-win');
  e.clipLoaded(6.08); e.clipEnded(); fx = e.advance();
  const end = find(fx, 'ending');
  assert.ok(end, 'reached the ending');
  assert.equal(end.summary.hits, 3);
  assert.equal(end.summary.deaths, 0);
  assert.equal(end.summary.score, 300);
  assert.deepEqual(end.summary.recap, ['Dodged the falling gate stone.', 'Read the contract before signing.', 'Ducked the dragon’s flame and kept the reserve.']);
});

test('wrong move, timeout and decoys each cost a life and return to the checkpoint', () => {
  const e = createEngine(creditsGame);
  e.start();
  let fx = playScene(e, 'right');
  assert.equal(find(fx, 'judge').verdict, 'wrong');
  assert.equal(find(fx, 'play').clip, 'gate-fail');
  e.clipLoaded(6.08); fx = e.clipEnded();
  assert.equal(find(fx, 'death').lives, 2);
  fx = e.advance();
  assert.equal(find(fx, 'play').clip, 'gate-threat');
  fx = playScene(e, null);
  assert.equal(find(fx, 'judge').verdict, 'miss');
  e.clipLoaded(6.08); fx = e.clipEnded();
  assert.equal(find(fx, 'death').lives, 1);
  e.advance();
  fx = playScene(e, 'up');
  assert.equal(find(fx, 'judge').verdict, 'wrong');
  e.clipLoaded(6.08); fx = e.clipEnded();
  assert.ok(find(fx, 'gameover'));
  assert.equal(e.state.lives, 0);
  assert.deepEqual(e.advance(), [], 'advance does nothing after game over');
  fx = e.practice();
  assert.equal(e.state.mode, 'guided');
  assert.equal(find(fx, 'play').clip, 'gate-threat');
});

test('early input is ignored by default and the window boundaries are inclusive', () => {
  const e = createEngine(creditsGame);
  e.start();
  e.clipLoaded(6);
  let fx = e.input('left');
  assert.deepEqual(types(fx), ['early']);
  fx = e.tick(0.52 * 6);
  assert.ok(find(fx, 'cue'));
  fx = e.tick(0.93 * 6);
  assert.ok(!find(fx, 'judge'), 'still open at close');
  fx = e.tick(0.93 * 6 + 0.01);
  assert.equal(find(fx, 'judge').verdict, 'miss');
});

test('guided mode holds the film at the cue and never times out', () => {
  const e = createEngine(creditsGame, { mode: 'guided' });
  e.start(); e.clipLoaded(6);
  let fx = e.tick(4);
  assert.equal(find(fx, 'cue').hold, true);
  fx = e.tick(60);
  assert.ok(!find(fx, 'judge'));
  fx = e.input('right');
  assert.equal(find(fx, 'judge').verdict, 'wrong');
  e.clipLoaded(6); fx = e.clipEnded();
  assert.equal(find(fx, 'death').lives, 3, 'guided mode keeps lives');
});

test('multi-beat clip keeps rolling after a hit and cuts on a wrong move with its own death', () => {
  const e = createEngine(lanternGame);
  let fx = e.start();
  assert.ok(find(fx, 'card'));
  fx = e.advance();
  assert.equal(find(fx, 'play').clip, 'riverbank');
  fx = playScene(e, 'right', { duration: 8 });
  assert.equal(find(fx, 'play').clip, 'bridge-approach');
  e.clipLoaded(8);
  fx = e.tick(0.2 * 8);
  assert.equal(find(fx, 'cue').index, 0);
  fx = e.input('up');
  assert.equal(find(fx, 'judge').verdict, 'hit');
  assert.ok(!find(fx, 'play'), 'film keeps rolling after the jump');
  fx = e.tick(0.6 * 8);
  assert.equal(find(fx, 'cue').index, 1);
  fx = e.input('up');
  assert.equal(find(fx, 'play').clip, 'bridge-clothesline');
  e.clipLoaded(8); fx = e.clipEnded();
  assert.equal(find(fx, 'death').retry, 'bridge-approach', 'death with no retry returns to the checkpoint');
  fx = e.advance();
  assert.equal(find(fx, 'play').clip, 'bridge-approach');
  e.clipLoaded(8); e.tick(0.2 * 8); e.input('up'); e.tick(0.6 * 8); e.input('down');
  fx = e.clipEnded();
  assert.equal(find(fx, 'play').clip, 'tollhouse', 'scene.next after the last beat');
  assert.equal(e.state.score, 100 * 4 + 250 * 2, 'four hits, two scenes cleared, deaths earn nothing');
});

test('branching: two correct moves lead to different endings', () => {
  const policy = choice => (node, beat) => node.type === 'scene' && beat.moves[choice] ? choice : firstCorrect(node, beat);
  const g = { nodes: lantern.nodes, start: lantern.start };
  assert.equal(walk(g, policy('action')).at(-1), 'end-city');
  assert.equal(walk(g, policy('up')).at(-1), 'end-friend');
  assert.deepEqual(walk(g, () => 'left').slice(0, 4), ['title-card', 'riverbank', 'boat', 'bridge-approach']);
});

test('graph helpers', () => {
  const g = { nodes: lantern.nodes, start: lantern.start };
  assert.equal(reachable(g).size, Object.keys(lantern.nodes).length);
  assert.equal(canReachEnding(g).size, Object.keys(lantern.nodes).length);
  assert.deepEqual(nextClips(g, 'title-card'), ['riverbank']);
  assert.deepEqual(nextClips(g, 'tollhouse').sort(), ['toll-honest', 'toll-letter', 'toll-spoon']);
});

test('beat move specs and keyboard mapping', () => {
  const beat = creditsGame.nodes.dragon.beats[0];
  const moves = beatMoves(beat);
  assert.deepEqual(moves.map(m => [m.id, m.key, m.correct]), [['duck', 'down', true], ['strike', 'up', false]]);
  assert.equal(moveForKey(beat, 'arrowdown'), 'duck');
  assert.equal(moveForKey(beat, 's'), 'duck');
  assert.equal(moveForKey(beat, ' '), 'duck', 'extra keys from the story');
  assert.equal(moveForKey(beat, 'w'), 'strike');
  assert.equal(moveForKey(beat, 'x'), null);
});
