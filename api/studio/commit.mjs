// POST /api/studio/commit { slug, files: { 'brief.md': '...', 'story.mjs': '...' }, message? }
// Commits workshop output to stories/<slug>/ on branch studio/<slug> in GITHUB_REPO using GITHUB_TOKEN.
const API = 'https://api.github.com';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO;
  if (!token || !repo) return res.status(503).json({ error: 'GitHub hand-off is off: set GITHUB_TOKEN and GITHUB_REPO (owner/name) in Vercel.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const slug = String(body.slug || '');
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return res.status(400).json({ error: 'bad slug' });
  const files = body.files || {};
  const names = Object.keys(files).filter(n => /^[a-z0-9._-]+$/i.test(n) && typeof files[n] === 'string');
  if (!names.length) return res.status(400).json({ error: 'no files' });
  const branch = `studio/${slug}`;
  const gh = async (p, init = {}) => {
    const r = await fetch(API + p, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'polyester-workshop', ...(init.headers || {}) } });
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 404) throw new Error(`GitHub ${r.status}: ${j.message || p}`);
    return { status: r.status, json: j };
  };
  try {
    const def = (await gh(`/repos/${repo}`)).json.default_branch || 'main';
    const head = await gh(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    if (head.status === 404) {
      const base = await gh(`/repos/${repo}/git/ref/heads/${def}`);
      await gh(`/repos/${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.json.object.sha }) });
    }
    const written = [];
    for (const name of names) {
      const p = `stories/${slug}/${name}`;
      const existing = await gh(`/repos/${repo}/contents/${p}?ref=${encodeURIComponent(branch)}`);
      const payload = { message: body.message || `Workshop: ${slug}/${name}`, content: Buffer.from(files[name], 'utf8').toString('base64'), branch };
      if (existing.status === 200 && existing.json.sha) payload.sha = existing.json.sha;
      const r = await gh(`/repos/${repo}/contents/${p}`, { method: 'PUT', body: JSON.stringify(payload) });
      written.push({ path: p, url: r.json.content?.html_url || null });
    }
    return res.status(200).json({ ok: true, branch, written, url: `https://github.com/${repo}/tree/${branch}/stories/${slug}` });
  } catch (e) { return res.status(502).json({ error: e.message }); }
}
