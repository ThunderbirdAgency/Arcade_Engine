import { emptyBrief, briefToMarkdown, briefToStory, storyToModule, slugify } from '/studio/scaffold.mjs';
import { lintStory, formatLint } from '/studio/lint.mjs';

const $ = id => document.getElementById(id);
const KEY = 'pp.workshop.v1';
let db = load(), current = null, out = { md: '', mjs: '', story: null };
let session = { draft: false, github: false };

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { projects: {} }; } catch { return { projects: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }
function toast(t) { $('toast').textContent = t; $('toast').classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => $('toast').classList.remove('on'), 2600); }

// ---- form <-> brief
const F = $('form');
const scalar = ['title', 'episode', 'tagline', 'logline', 'synopsis', 'audience', 'lesson', 'look', 'palette', 'tone', 'safety', 'duration', 'resolution', 'lives', 'endingTitle', 'secretEnding', 'endingBody', 'notes'];
const LISTS = {
  characters: { fields: [['name', 'NAME', 'input'], ['description', 'LOCKED DESCRIPTION (what every film must preserve)', 'textarea'], ['rules', 'RULES (what must never change)', 'input']] },
  locations: { fields: [['name', 'NAME', 'input'], ['description', 'LOCKED DESCRIPTION', 'textarea']] },
  scenes: { fields: [['title', 'SCENE TITLE', 'input'], ['location', 'WHERE (a place name from above)', 'input'], ['cast', 'WHO (character names, comma separated)', 'input'], ['setup', 'WHAT WE SEE BEFORE THE MOVE', 'textarea'], ['danger', 'THE DANGER OR CHOICE', 'input'], ['cue', 'CUE SHOWN TO THE PLAYER', 'input'], ['move', 'RIGHT MOVE', 'move'], ['moveLabel', 'RIGHT MOVE LABEL', 'input'], ['win', 'WHAT HAPPENS ON THE RIGHT MOVE', 'textarea'], ['wrongMove', 'WRONG MOVE', 'move'], ['wrongLabel', 'WRONG MOVE LABEL', 'input'], ['fail', 'THE COMIC SETBACK ON THE WRONG MOVE', 'textarea'], ['lesson', 'LESSON CARD AFTER THE WIN', 'input']] },
};
function itemHtml(list, i, v) {
  const f = LISTS[list].fields.map(([k, label, type]) => {
    const val = v[k] ?? '';
    if (type === 'move') return `<label class="q"><span>${label}</span><select data-k="${k}">${['left', 'right', 'up', 'down', 'action'].map(m => `<option ${m === val ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`;
    if (type === 'textarea') return `<label class="q"><span>${label}</span><textarea data-k="${k}">${esc(val)}</textarea></label>`;
    return `<label class="q"><span>${label}</span><input data-k="${k}" value="${esc(val)}"></label>`;
  }).join('');
  return `<div class="item" data-list="${list}" data-i="${i}"><button type="button" class="rm">remove</button>${f}</div>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function render(b) {
  for (const k of scalar) if (F.elements[k]) F.elements[k].value = b[k] ?? '';
  for (const list of Object.keys(LISTS)) $(list).innerHTML = (b[list] || []).map((v, i) => itemHtml(list, i, v)).join('');
  $('heading').textContent = b.title || 'New story';
}
function read() {
  const b = emptyBrief();
  for (const k of scalar) if (F.elements[k]) b[k] = F.elements[k].value;
  for (const list of Object.keys(LISTS)) b[list] = [...$(list).querySelectorAll('.item')].map(el => Object.fromEntries([...el.querySelectorAll('[data-k]')].map(x => [x.dataset.k, x.value])));
  return b;
}
function persist() {
  const b = read();
  if (!current) current = 'draft-' + Date.now().toString(36);
  db.projects[current] = { brief: b, updated: Date.now() };
  save(); renderProjects(); $('heading').textContent = b.title || 'New story';
}
F.addEventListener('input', () => { clearTimeout(persist.t); persist.t = setTimeout(persist, 300); });
F.addEventListener('click', e => {
  if (e.target.matches('.add')) { const list = e.target.dataset.add; const b = read(); b[list].push(emptyBrief()[list][0]); render(b); persist(); }
  if (e.target.matches('.rm')) { const el = e.target.closest('.item'); const b = read(); b[el.dataset.list].splice(Number(el.dataset.i), 1); render(b); persist(); }
});

// ---- projects
function renderProjects() {
  const items = Object.entries(db.projects).sort((a, b) => b[1].updated - a[1].updated);
  $('projects').innerHTML = items.map(([id, p]) => `<li><button class="${id === current ? 'on' : ''}" data-open="${id}">${esc(p.brief.title || 'Untitled')}</button><button class="x" data-del="${id}" title="Delete">✕</button></li>`).join('') || '<li><span style="font-size:13px;color:#5c534b">Nothing yet.</span></li>';
}
$('projects').onclick = e => {
  const open = e.target.dataset.open, del = e.target.dataset.del;
  if (open) { current = open; render(db.projects[open].brief); renderProjects(); $('out').hidden = true; }
  if (del && confirm('Delete this project from this browser?')) { delete db.projects[del]; if (current === del) { current = null; render(emptyBrief()); } save(); renderProjects(); }
};
$('new').onclick = () => { current = null; render(emptyBrief()); renderProjects(); $('out').hidden = true; window.scrollTo(0, 0); };
$('import').onclick = () => $('importFile').click();
$('importFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const b = { ...emptyBrief(), ...JSON.parse(await f.text()) }; current = null; render(b); persist(); toast('Imported.'); } catch { toast('That file is not a brief.'); } };

// ---- build
function build() {
  const b = read();
  if (!b.title) { toast('Give it a title first.'); F.elements.title.focus(); return null; }
  const story = briefToStory(b);
  const lint = lintStory(story);
  show(b, story, lint, '');
  return { b, story, lint };
}
function show(b, story, lint, note) {
  out = { md: briefToMarkdown(b), mjs: storyToModule(story), story, brief: b };
  $('md').textContent = out.md; $('mjs').textContent = out.mjs;
  $('lint').textContent = lint.errors.length || lint.warnings.length ? formatLint(lint) : '✓ lints clean · ' + Object.keys(story.nodes).length + ' nodes';
  $('draftNote').textContent = note; $('out').hidden = false; $('out').scrollIntoView({ behavior: 'smooth' });
}
$('build').onclick = () => { build() && toast('Built.'); };
$('draft').onclick = async () => {
  if (!session.draft) return toast('Drafting needs ANTHROPIC_API_KEY set in Vercel.');
  const b = read(); if (!b.title) return toast('Give it a title first.');
  $('draft').disabled = true; $('draft').textContent = 'Drafting… (a minute or two)';
  try {
    const r = await fetch('/api/studio/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: b }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'draft failed');
    show(b, j.story, j.lint || { errors: [], warnings: [] }, `drafted by Claude in ${j.attempts} pass${j.attempts === 1 ? '' : 'es'}`);
    toast(j.clean ? 'Draft lints clean.' : 'Draft has lint errors to fix.');
  } catch (e) { toast(e.message); } finally { $('draft').disabled = false; $('draft').textContent = 'Draft with Claude'; }
};
$('send').onclick = async () => {
  if (!out.story) { if (!build()) return; }
  if (!session.github) return toast('Sending needs GITHUB_TOKEN and GITHUB_REPO set in Vercel. Use Download instead.');
  $('send').disabled = true;
  try {
    const r = await fetch('/api/studio/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: out.story.slug, files: { 'brief.md': out.md, 'story.mjs': out.mjs, 'brief.json': JSON.stringify(out.brief, null, 2) }, message: `Workshop: ${out.story.title}` }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'commit failed');
    toast(`Committed to ${j.branch}`); window.open(j.url, '_blank');
  } catch (e) { toast(e.message); } finally { $('send').disabled = false; }
};
$('download').onclick = () => {
  if (!out.story) { if (!build()) return; }
  const slug = out.story.slug;
  dl(`${slug}-brief.md`, out.md, 'text/markdown'); dl(`${slug}-story.mjs`, out.mjs, 'text/javascript'); dl(`${slug}-brief.json`, JSON.stringify(out.brief, null, 2), 'application/json');
};
$('copyPrompt').onclick = async () => {
  if (!out.story) { if (!build()) return; }
  const slug = out.story.slug;
  const text = `Pull the Arcade_Engine repo. Create stories/${slug}/story.mjs from the story file below (and stories/${slug}/brief.md from the brief). Run \`npm run story -- ${slug} lint\`, fix anything it reports, then \`plan\` and \`pack\`, and walk me through the film order before submitting anything to Higgsfield.\n\n=== brief.md ===\n${out.md}\n\n=== story.mjs ===\n${out.mjs}`;
  await navigator.clipboard.writeText(text); toast('Hand-off prompt copied. Paste it into a coding session.');
};
document.querySelectorAll('[data-copy]').forEach(b => { b.onclick = async () => { await navigator.clipboard.writeText(out[b.dataset.copy] || ''); toast('Copied.'); }; });
function dl(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

// ---- games + integrations
async function loadGames() {
  try {
    const idx = await (await fetch('/games/index.json', { cache: 'no-cache' })).json();
    $('games').innerHTML = idx.games.map(g => `<li><b>${esc(g.title)}</b><span>${g.films} films${g.playable ? '' : ' · not playable yet'}</span>${g.playable ? `<a href="/play/?game=${g.slug}">Play</a><button class="link" data-share="${g.slug}">Share link</button>` : ''}</li>`).join('');
  } catch { $('games').innerHTML = '<li>Could not load games.</li>'; }
}
$('games').onclick = async e => {
  const slug = e.target.dataset.share; if (!slug) return;
  const r = await fetch('/api/studio/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: slug, days: 30 }) });
  const j = await r.json(); if (!r.ok) return toast(j.error || 'no link');
  await navigator.clipboard.writeText(j.url); toast(`Share link copied (valid ${j.days} days).`);
};
async function loadSession() {
  try { session = await (await fetch('/api/studio/session')).json(); } catch {}
  $('status').innerHTML = `Draft with Claude: ${session.draft ? '<b>on</b>' : '<i>off</i> (set ANTHROPIC_API_KEY)'}<br>Workshop branches: ${session.github ? `<b>on</b> → ${esc(session.repo)}` : '<i>off</i> (set GITHUB_TOKEN + GITHUB_REPO)'}`;
  if (session.github) { try { const p = await (await fetch('/api/studio/projects')).json(); if (p.projects?.length) $('status').innerHTML += `<br>On GitHub: ${p.projects.map(x => `<a href="${x.url}" target="_blank">${esc(x.slug)}</a>`).join(', ')}`; } catch {} }
}
$('logout').onclick = async e => { e.preventDefault(); await fetch('/api/logout', { method: 'POST' }); location.href = '/'; };

// ---- boot
const last = Object.entries(db.projects).sort((a, b) => b[1].updated - a[1].updated)[0];
if (last) { current = last[0]; render(last[1].brief); } else render(emptyBrief());
renderProjects(); loadGames(); loadSession();
