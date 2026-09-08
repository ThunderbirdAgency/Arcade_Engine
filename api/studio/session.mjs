// GET /api/studio/session → which optional integrations are configured (never the values).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    draft: Boolean(process.env.ANTHROPIC_API_KEY),
    github: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
    repo: process.env.GITHUB_REPO || null,
  });
}
