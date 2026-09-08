import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeMp4 } from '../pipeline/mp4.mjs';
import { buildPack, verifyChecklist } from '../pipeline/pack.mjs';
import { toApiBody } from '../pipeline/providers/higgsfield-api.mjs';
import { compileStory, loadMedia, saveMedia } from '../pipeline/compile.mjs';
import { ingest } from '../pipeline/ingest.mjs';
import { review } from '../pipeline/review.mjs';
import { goldenClips } from '../pipeline/stitch.mjs';
import lantern from '../stories/lantern-bridge/story.mjs';
import credits from '../stories/credits-lair/story.mjs';

const FILM = 'dist/assets/films/gate-threat.mp4';

test('mp4 prober reads duration, size and fast-start from the shipped films', () => {
  const p = probeMp4(FILM);
  assert.equal(p.duration, 6.08);
  assert.equal(p.width, 1920);
  assert.equal(p.height, 1080);
  assert.equal(p.fastStart, true);
});

test('job pack stages assets before films and orders chained films after their parents', () => {
  const { shots } = compileStory(lantern, { clips: {} }, { distDir: '/nonexistent' });
  const pack = buildPack(shots, { clips: {} });
  assert.equal(pack.provider, 'higgsfield-session');
  assert.deepEqual(pack.stages.assets.map(a => a.id).sort(), ['keyframe:bridge', 'keyframe:riverbank', 'keyframe:tollhouse', 'sheet:pip', 'sheet:troll']);
  const order = pack.stages.films.map(f => f.clip);
  assert.ok(order.indexOf('riverbank') < order.indexOf('boat'));
  assert.ok(order.indexOf('bridge-approach') < order.indexOf('tollhouse'));
  const boat = pack.stages.films.find(f => f.clip === 'boat');
  assert.deepEqual(boat.dependsOn, ['film:riverbank']);
  assert.deepEqual(boat.params.medias.map(m => m.role), ['start_image', 'image_references', 'video_references']);
  assert.equal(boat.params.medias[0].value, '{{clip:riverbank:last}}');
  assert.equal(boat.params.model, 'seedance_2_5');
  assert.equal(boat.params.duration, 8);
  assert.equal(boat.params.bitrate_mode, 'high');
  assert.ok(boat.verify.some(v => v.includes('No titles')));
  const first = pack.stages.films.find(f => f.clip === 'riverbank');
  assert.equal(first.params.medias[0].value, '{{keyframe:riverbank}}');
});

test('pack skips ready films unless --all, and --only filters', () => {
  const media = { clips: { 'gate-threat': { src: '/assets/films/gate-threat.mp4' } } };
  const { shots } = compileStory(credits, media, { distDir: 'dist' });
  const pack = buildPack(shots, media);
  assert.ok(!pack.stages.films.some(f => f.clip === 'gate-threat'));
  assert.equal(buildPack(shots, media, { includeReady: true }).stages.films.length, 9);
  assert.deepEqual(buildPack(shots, media, { only: ['dragon-win'] }).stages.films.map(f => f.clip), ['dragon-win']);
  assert.equal(pack.stages.assets.length, 0, 'Credit’s Lair has keyframes and sheets already');
});

test('verify checklist names every cast member and the location', () => {
  const { shots } = compileStory(lantern, { clips: {} }, { distDir: '/nonexistent' });
  const list = verifyChecklist(shots, shots.shots.find(s => s.clip === 'tollhouse'));
  assert.ok(list.some(l => l.startsWith('Pip appears')));
  assert.ok(list.some(l => l.startsWith('the toll troll appears')));
  assert.ok(list.some(l => l.includes('crooked wooden tollhouse')));
});

test('http provider body matches the Higgsfield image-to-video schema', () => {
  const body = toApiBody({ prompt: 'p', duration: 8, resolution: '1080p', aspect_ratio: '16:9' }, 'https://x/y.webp');
  assert.deepEqual(body, { prompt: 'p', image_url: 'https://x/y.webp', duration: 8, resolution: '1080', aspect_ratio: '16:9' });
});

test('ingest copies a film into dist, probes it, records the prompt hash, and review writes a checklist', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-'));
  const slug = 'lantern-bridge';
  const before = fs.existsSync(`stories/${slug}/media.json`) ? fs.readFileSync(`stories/${slug}/media.json`, 'utf8') : null;
  try {
    const { shots } = compileStory(lantern, { clips: {} }, { distDir: tmp });
    const report = await ingest(slug, shots, [{ id: 'film:riverbank', jobId: 'job-1', file: FILM, model: 'seedance_2_5' }], { distDir: tmp, frames: false });
    assert.equal(report[0].clip, 'riverbank');
    assert.equal(report[0].duration, 6.08);
    assert.ok(report[0].problems.some(p => p.includes('differs from the planned 8s')), 'flags a duration mismatch');
    const media = loadMedia(slug);
    assert.equal(media.clips.riverbank.hash, shots.shots.find(s => s.clip === 'riverbank').hash);
    assert.equal(media.clips.riverbank.src, '/games/lantern-bridge/films/riverbank.mp4');
    assert.ok(fs.existsSync(path.join(tmp, media.clips.riverbank.src)));
    assert.equal(media.clips.riverbank.review.status, 'pending');
    const compiled = compileStory(lantern, media, { distDir: tmp });
    assert.equal(compiled.status.ready, 1);
    const out = await review(slug, shots, { distDir: tmp, mode: 'manual', frames: false });
    assert.equal(out.length, 1);
    assert.equal(out[0].status, 'pending');
    const md = fs.readFileSync(`stories/${slug}/review/checklist.md`, 'utf8');
    assert.ok(md.includes('## riverbank'));
    assert.ok(md.includes('- [ ] Pip appears'));
  } finally {
    if (before === null) fs.rmSync(`stories/${slug}/media.json`, { force: true }); else fs.writeFileSync(`stories/${slug}/media.json`, before);
    fs.rmSync(`stories/${slug}/review`, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('golden clips follow the first correct move everywhere', () => {
  assert.deepEqual(goldenClips(credits), ['gate-threat', 'gate-win', 'merchant-threat', 'merchant-win', 'dragon-threat', 'dragon-win']);
  assert.deepEqual(goldenClips(lantern), ['riverbank', 'boat', 'bridge-approach', 'tollhouse', 'toll-honest']);
});
