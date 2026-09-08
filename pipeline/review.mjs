// Congruency review: for every ingested film, build a contact sheet and check it against the
// shot's verify checklist. With ANTHROPIC_API_KEY (or an `ant auth login` profile) and the
// @anthropic-ai/sdk package present, Claude reviews the frames and returns a structured verdict.
// Without them, a markdown checklist is written for a human reviewer. Verdicts land in media.json.
import fs from 'node:fs';
import path from 'node:path';
import { extractFrames, sheetTimes } from './frames.mjs';
import { verifyChecklist } from './pack.mjs';
import { loadMedia, saveMedia, STORIES_DIR } from './compile.mjs';

const MODEL = process.env.ARCADE_REVIEW_MODEL || 'claude-opus-5';

export async function review(slug, shots, { distDir = 'dist', only = null, mode = 'auto', frames = true } = {}) {
  const media = loadMedia(slug);
  const reviewDir = path.join(STORIES_DIR, slug, 'review');
  fs.mkdirSync(reviewDir, { recursive: true });
  const client = mode === 'manual' ? null : await makeClient();
  const results = [];
  const checklistMd = [`# Review checklist · ${slug}`, ''];
  for (const shot of shots.shots) {
    if (only && !only.includes(shot.clip)) continue;
    const entry = media.clips?.[shot.clip];
    if (!entry?.src) continue;
    const file = path.join(distDir, entry.src);
    if (!fs.existsSync(file)) continue;
    const checklist = shot.verify || verifyChecklist(shots, shot);
    let sheet = [];
    if (frames) {
      try { sheet = await extractFrames(file, sheetTimes(entry.duration || shot.duration || 6), path.join(reviewDir, 'frames'), { duration: entry.duration }); }
      catch (e) { results.push({ clip: shot.clip, status: 'pending', note: `frames unavailable: ${e.message}` }); }
    }
    checklistMd.push(`## ${shot.clip} (${shot.kind}, node ${shot.nodeId})`, '', ...checklist.map(c => `- [ ] ${c}`), '', sheet.length ? sheet.map(f => `![](${path.relative(reviewDir, f.file)})`).join(' ') : '_no frames extracted_', '');
    if (client && sheet.length) {
      const verdict = await askClaude(client, shot, checklist, sheet.map(f => f.file));
      entry.review = { status: verdict.pass ? 'approved' : 'rejected', by: MODEL, date: new Date().toISOString().slice(0, 10), issues: verdict.issues, fix: verdict.fix || null, confidence: verdict.confidence };
      results.push({ clip: shot.clip, ...entry.review });
    } else if (!results.some(r => r.clip === shot.clip)) {
      entry.review = { ...(entry.review || {}), status: entry.review?.status === 'approved' ? 'approved' : 'pending' };
      results.push({ clip: shot.clip, status: entry.review.status, note: client ? undefined : 'no reviewer model available; see review/checklist.md' });
    }
  }
  fs.writeFileSync(path.join(reviewDir, 'checklist.md'), checklistMd.join('\n'));
  saveMedia(slug, media);
  return results;
}

async function makeClient() {
  let sdk;
  try { sdk = await import('@anthropic-ai/sdk'); } catch { return null; }
  try { return new sdk.default(); } catch { return null; }
}

/** Ask Claude to grade a contact sheet against the checklist. Returns { pass, issues[], fix, confidence }. */
export async function askClaude(client, shot, checklist, frameFiles) {
  const content = frameFiles.map(f => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: fs.readFileSync(f).toString('base64') } }));
  content.push({
    type: 'text',
    text: [
      `These ${frameFiles.length} frames are evenly spaced samples from one generated animated film (${shot.kind} shot "${shot.clip}").`,
      'The film was generated from this prompt:', shot.prompt, '',
      'Grade the film against every item in this checklist. Fail the film if any item clearly fails. Be strict about on-screen text and about the action matching the prompt.',
      ...checklist.map((c, i) => `${i + 1}. ${c}`),
      '', 'If it fails, write a one-sentence prompt amendment that would fix it on regeneration.',
    ].join('\n'),
  });
  const res = await client.messages.create({
    model: MODEL, max_tokens: 2000,
    system: 'You are a continuity supervisor for a hand-drawn animated adventure game. You review generated films for consistency with the character bible, the location, the described action and the no-text rule. Answer only with the requested JSON.',
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema: {
      type: 'object', additionalProperties: false,
      properties: {
        pass: { type: 'boolean' },
        confidence: { type: 'number' },
        issues: { type: 'array', items: { type: 'string' } },
        fix: { type: 'string' },
      },
      required: ['pass', 'confidence', 'issues', 'fix'],
    } } },
  });
  if (res.stop_reason === 'refusal') return { pass: false, confidence: 0, issues: ['reviewer declined to grade this film'], fix: '' };
  const text = res.content.find(b => b.type === 'text')?.text || '{}';
  return JSON.parse(text);
}
