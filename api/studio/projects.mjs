// GET /api/studio/projects → workshop branches (studio/*) and shipped stories in GITHUB_REPO.
const API = 'https://api.github.com';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO;
  if (!token || !repo) return res.status(200).json({ ok: false, projects: [] });
  const gh = async p => { const r = await fetch(API + p, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'polyester-workshop' } }); return r.ok ? r.json() : null; };
  try {
    const branches = (await gh(`/repos/${repo}/branches?per_page=100`)) || [];
    const projects = branches.filter(b => b.name.startsWith('studio/')).map(b => ({ slug: b.name.slice(7), branch: b.name, url: `https://github.com/${repo}/tree/${b.name}/stories/${b.name.slice(7)}` }));
    const shipped = ((await gh(`/repos/${repo}/contents/stories`)) || []).filter(e => e.type === 'dir').map(e => e.name);
    return res.status(200).json({ ok: true, projects, shipped, repo });
  } catch (e) { return res.status(200).json({ ok: false, projects: [], error: e.message }); }
}
