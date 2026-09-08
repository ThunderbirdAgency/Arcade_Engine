// Higgsfield public HTTP API provider (https://docs.higgsfield.ai).
// Auth: Authorization: Key <HIGGSFIELD_KEY_ID>:<HIGGSFIELD_KEY_SECRET>
// Submit: POST https://api.higgsfield.ai/<model-path> with JSON body → { request_id, status_url }
// Poll:   GET  status_url → { status: queued|in_progress|completed|failed|nsfw|canceled, video: { url } }
// The Seedance 2.5 model used for Credit’s Lair is currently only exposed through the Higgsfield app
// and MCP (see providers/session.mjs). The HTTP API exposes Seedance v1 image-to-video routes.
const BASE = process.env.HIGGSFIELD_API_BASE || 'https://api.higgsfield.ai';
const DEFAULT_ROUTE = process.env.HIGGSFIELD_VIDEO_ROUTE || '/bytedance/seedance/v1/pro/fast/image-to-video';

function auth() {
  const id = process.env.HIGGSFIELD_KEY_ID, secret = process.env.HIGGSFIELD_KEY_SECRET;
  if (!id || !secret) throw new Error('Set HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET (never commit them).');
  return { Authorization: `Key ${id}:${secret}`, 'Content-Type': 'application/json' };
}

/** Map a pack film request to the HTTP image-to-video body. imageUrl must be a public https URL. */
export function toApiBody(params, imageUrl) {
  return {
    prompt: params.prompt,
    image_url: imageUrl,
    duration: Math.max(4, Math.min(12, Math.round(params.duration || 5))),
    resolution: String(params.resolution || '1080').replace('p', ''),
    aspect_ratio: params.aspect_ratio || '16:9',
  };
}

export async function submit(params, imageUrl, route = DEFAULT_ROUTE) {
  const res = await fetch(BASE + route, { method: 'POST', headers: auth(), body: JSON.stringify(toApiBody(params, imageUrl)) });
  if (!res.ok) throw new Error(`Higgsfield submit failed: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { jobId: json.request_id, statusUrl: json.status_url, status: json.status };
}

export async function poll(statusUrl, { intervalMs = 8000, timeoutMs = 20 * 60 * 1000 } = {}) {
  const started = Date.now();
  for (;;) {
    const res = await fetch(statusUrl, { headers: auth() });
    if (!res.ok) throw new Error(`Higgsfield status failed: HTTP ${res.status}`);
    const json = await res.json();
    if (json.status === 'completed') return { status: 'completed', url: json.video?.url, raw: json };
    if (['failed', 'nsfw', 'canceled'].includes(json.status)) return { status: json.status, error: json.error, raw: json };
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for the film.');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

export const name = 'higgsfield-api';
