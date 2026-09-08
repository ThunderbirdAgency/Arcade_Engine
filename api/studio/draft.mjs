// POST /api/studio/draft { brief } → { story, module, lint }
// Expands a workshop brief into a complete story that lints clean, using Claude. Needs ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { lintStory, formatLint } from '../../pipeline/lint.mjs';
import { briefToMarkdown, briefToStory, storyToModule, slugify } from '../../studio/scaffold.mjs';
import { FORMAT_GUIDE } from '../../studio/guide.mjs';
import example from '../../stories/lantern-bridge/story.mjs';

// Claude Fable 5.1: thinking is always on (no `thinking` param), depth is set with output_config.effort.
const MODEL = process.env.STUDIO_DRAFT_MODEL || 'claude-fable-5-1';
export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Drafting is off: set ANTHROPIC_API_KEY in Vercel to enable it.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const brief = body.brief;
  if (!brief?.title) return res.status(400).json({ error: 'A title is the minimum.' });

  const client = new Anthropic();
  const scaffold = briefToStory(brief);
  const system = [
    'You are the story editor for ArcadeEngine, a Dragon’s Lair-style interactive cartoon engine. You turn a writer’s brief into a complete story file.',
    'Output exactly one JSON object and nothing else: the story object in the format below. No markdown fences, no commentary.',
    FORMAT_GUIDE,
    'Rules that matter most: every filmed node needs location, cast, shot.action and shot.ends written as directions a video model can animate in one continuous shot (say what happens at which second, which side of frame is safe, how it ends on suspense). Character and location descriptions are locked strings; never paraphrase them inside shot.action, refer to the character by name. Every scene needs at least one beat with a cue, a correct move, a decoy or wrong-move film, and a miss target that is a death. Deaths are comic and harmless. Every path must reach an ending. Use the writer’s scenes in order; add cards for chapter breaks and cuts for story moments; invent nothing that contradicts the brief. Keep slug, title, characters and locations from the scaffold ids where they exist.',
    'Here is a complete example story that lints clean:',
    JSON.stringify(example),
  ].join('\n\n');
  const user = `WRITER’S BRIEF (markdown):\n\n${briefToMarkdown(brief)}\n\nSCAFFOLD (a minimal valid story built from the brief; improve it, keep its ids):\n\n${JSON.stringify(scaffold)}`;

  let messages = [{ role: 'user', content: user }];
  let story = null, lint = null, attempts = 0, lastError = null;
  while (attempts < 2) {
    attempts++;
    let text = '';
    try {
      const stream = client.beta.messages.stream({
        model: MODEL, max_tokens: 48000, system, messages,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'xhigh' },
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'The drafting model declined this brief.', detail: msg.stop_details?.explanation || null });
      text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? e.status : 500;
      return res.status(502).json({ error: `Drafting failed (${status}): ${e.message}` });
    }
    try { story = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { lastError = 'The draft was not valid JSON.'; messages = [...messages, { role: 'assistant', content: text }, { role: 'user', content: 'That was not a single valid JSON object. Return only the JSON story object.' }]; continue; }
    story.slug = slugify(brief.title);
    lint = lintStory(story);
    if (!lint.errors.length) break;
    lastError = formatLint(lint);
    messages = [...messages, { role: 'assistant', content: text }, { role: 'user', content: `The linter rejected the story. Fix every error and return the complete corrected JSON object:\n${lastError}` }];
  }
  if (!story) return res.status(502).json({ error: lastError || 'No draft produced.' });
  return res.status(200).json({ story, module: storyToModule(story), lint: lint ? { errors: lint.errors, warnings: lint.warnings } : null, clean: lint ? lint.errors.length === 0 : false, attempts });
}
