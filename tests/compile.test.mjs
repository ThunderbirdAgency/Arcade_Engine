import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintStory } from '../pipeline/lint.mjs';
import { compileStory } from '../pipeline/compile.mjs';
import { buildPrompt, promptHash } from '../pipeline/prompts.mjs';
import credits from '../stories/credits-lair/story.mjs';
import lantern from '../stories/lantern-bridge/story.mjs';

const rules = r => r.errors.map(e => e.rule);
const clone = s => structuredClone(s);

test('shipped stories lint clean', () => {
  for (const s of [credits, lantern]) {
    const r = lintStory(s);
    assert.deepEqual(r.errors, [], `${s.slug}: ${JSON.stringify(r.errors)}`);
  }
});

test('linter catches broken graphs and beats', () => {
  let s = clone(lantern); s.nodes.tollhouse.beats[0].moves.action.to = 'nowhere';
  assert.ok(rules(lintStory(s)).includes('N3'));

  s = clone(lantern); delete s.nodes['toll-honest'].next;
  assert.ok(rules(lintStory(s)).includes('G2'), 'dead end');

  s = clone(lantern); s.nodes['bridge-approach'].beats[1].at = [0.3, 0.5];
  assert.ok(rules(lintStory(s)).includes('B3'), 'overlapping beats');

  s = clone(lantern); s.nodes.riverbank.beats[0].moves = {};
  assert.ok(rules(lintStory(s)).includes('B6'));

  s = clone(lantern); s.nodes.riverbank.beats[0].moves.left.key = 'right';
  assert.ok(rules(lintStory(s)).includes('B8'), 'two moves on one key');

  s = clone(lantern); s.nodes.riverbank.cast = ['pip@wet'];
  assert.ok(rules(lintStory(s)).includes('C3'), 'undeclared character state');

  s = clone(lantern); s.nodes.riverbank.location = 'moon';
  assert.ok(rules(lintStory(s)).includes('C1'));

  s = clone(lantern); delete s.nodes['bridge-approach'].next;
  assert.ok(rules(lintStory(s)).includes('B12'), 'rolling last beat needs next');

  s = clone(lantern); delete s.nodes.riverbank.beats[0].miss;
  assert.ok(rules(lintStory(s)).includes('B10'));

  s = clone(lantern); s.nodes.extra = { type: 'cut', location: 'bridge', shot: { action: 'x' }, next: 'end-city', clip: 'riverbank' };
  assert.ok(rules(lintStory(s)).includes('M1'), 'clip collision');
});

test('location jumps without a card are flagged as warnings', () => {
  const s = clone(lantern);
  delete s.nodes['bridge-approach'].transition;
  const r = lintStory(s);
  assert.ok(r.warnings.some(w => w.rule === 'C5' && w.msg.startsWith('riverbank → bridge-approach')));
  assert.ok(!lintStory(lantern).warnings.some(w => w.rule === 'C5'), 'transition flag silences it');
});

test('prompts are deterministic and carry every locked description', () => {
  const p1 = buildPrompt(lantern, 'tollhouse', lantern.nodes.tollhouse);
  const p2 = buildPrompt(lantern, 'tollhouse', lantern.nodes.tollhouse);
  assert.equal(p1, p2);
  assert.ok(p1.includes(lantern.characters.pip.description));
  assert.ok(p1.includes(lantern.characters.troll.description));
  assert.ok(p1.includes(lantern.locations.tollhouse.description));
  assert.ok(p1.startsWith(lantern.style.look));
  assert.ok(p1.includes('8-second continuous shot.'));
  assert.equal(promptHash(p1, lantern.production).length, 12);
  assert.notEqual(promptHash(p1, lantern.production), promptHash(p1, { ...lantern.production, duration: 9 }));
});

test('character states change the locked description', () => {
  const s = clone(credits);
  s.characters.knight.states = { gold: 'the young adult brown-haired knight, teal cloak, gleaming golden armor' };
  s.nodes.dragon.cast = ['knight@gold', 'dragon'];
  const p = buildPrompt(s, 'dragon', s.nodes.dragon);
  assert.ok(p.includes('gleaming golden armor'));
  assert.ok(!p.includes('worn bronze armor'));
});

test('compile reports missing, ready and drifted films and the golden path', () => {
  const media = { clips: { riverbank: { src: '/x.mp4', hash: 'stale0000000' } } };
  const r = compileStory(lantern, media, { distDir: '/nonexistent' });
  assert.equal(r.game.playable, false);
  assert.ok(r.status.missing.includes('riverbank'), 'src listed but file absent counts as missing');
  assert.deepEqual(r.status.drifted, ['riverbank']);
  assert.equal(r.status.shots, 10);
  assert.deepEqual(r.status.golden, ['title-card', 'riverbank', 'boat', 'bridge-approach', 'tollhouse', 'toll-honest', 'end-city']);
  assert.equal(r.shots.assets.filter(a => a.kind === 'keyframe').length, 3);
  assert.equal(r.shots.shots.find(s => s.clip === 'bridge-approach').startFrom.clip, 'riverbank', 'previous-frame chaining follows the golden path');
  assert.equal(r.game.nodes.riverbank.poster, '/games/lantern-bridge/keyframes/riverbank.webp');
});
