// Frame extraction for continuity chaining and review contact sheets.
// Uses ffmpeg when it is on PATH; otherwise falls back to a headless Chromium via Playwright
// (which decodes whatever the browser can play). Both produce PNG files.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function haveFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return r.status === 0;
}

/**
 * Extract frames at the given times (seconds; 'last' = duration - 0.05) into outDir.
 * Returns [{ time, file }].
 */
export async function extractFrames(videoFile, times, outDir, { duration } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(videoFile).replace(/\.[^.]+$/, '');
  const resolved = times.map(t => (t === 'last' ? Math.max(0, (duration ?? 6) - 0.05) : t));
  const outputs = resolved.map((t, i) => ({ time: t, label: times[i] === 'last' ? 'last' : String(t).replace('.', '_'), file: path.join(outDir, `${base}-${times[i] === 'last' ? 'last' : String(t).replace('.', '_')}.png`) }));
  if (haveFfmpeg()) {
    for (const o of outputs) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(o.time), '-i', videoFile, '-frames:v', '1', o.file]);
    return outputs;
  }
  let playwright;
  try { playwright = await import('playwright'); } catch { throw new Error('Frame extraction needs ffmpeg on PATH or the playwright package installed.'); }
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await playwright.chromium.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    const dataUrl = `data:video/mp4;base64,${fs.readFileSync(videoFile).toString('base64')}`;
    const shots = await page.evaluate(async ({ src, times }) => {
      const v = document.createElement('video'); v.muted = true; v.src = src; document.body.append(v);
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('browser cannot decode this video')); });
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      const out = [];
      for (const t of times) {
        v.currentTime = Math.min(t, Math.max(0, v.duration - 0.05));
        await new Promise(res => { v.onseeked = res; });
        c.getContext('2d').drawImage(v, 0, 0);
        out.push(c.toDataURL('image/png'));
      }
      return out;
    }, { src: dataUrl, times: resolved });
    outputs.forEach((o, i) => fs.writeFileSync(o.file, Buffer.from(shots[i].split(',')[1], 'base64')));
    return outputs;
  } finally { await browser.close(); }
}

/** Five evenly spaced frames for a review contact sheet. */
export const sheetTimes = duration => [0.1, 0.25, 0.5, 0.75, 1].map(f => Math.max(0, Math.min(duration - 0.05, f * duration)));

export const fileUrl = f => pathToFileURL(path.resolve(f)).href;
