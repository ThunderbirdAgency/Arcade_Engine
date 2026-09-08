// Generates short synthetic WebM "films" for browser tests (Playwright Chromium has no H.264).
// Each film shows its clip id and a running clock so a human can also watch the test.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const FFMPEG = process.env.PW_FFMPEG || fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('ffmpeg')).map(d => `/opt/pw-browsers/${d}/ffmpeg-linux`)[0];

export async function makeFilms(clips, outDir, { seconds = 6, fps = 10 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setContent('<canvas id=c width=640 height=360></canvas>');
  for (const clip of clips) {
    const frames = await page.evaluate(({ clip, seconds, fps }) => {
      const c = document.getElementById('c'), ctx = c.getContext('2d');
      const out = [];
      for (let i = 0; i < seconds * fps; i++) {
        const t = i / fps;
        ctx.fillStyle = `hsl(${(t / seconds) * 300},45%,25%)`; ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.fillText(clip, 30, 120);
        ctx.font = '32px monospace'; ctx.fillText(`t=${t.toFixed(1)}s`, 30, 200);
        ctx.fillStyle = '#ebcc80'; ctx.fillRect(0, 340, (t / seconds) * 640, 20);
        out.push(c.toDataURL('image/jpeg', 0.7).split(',')[1]);
      }
      return out;
    }, { clip, seconds, fps });
    const file = path.join(outDir, `${clip}.webm`);
    await new Promise((resolve, reject) => {
      const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '300k', file]);
      ff.on('error', reject); ff.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
      for (const f of frames) ff.stdin.write(Buffer.from(f, 'base64'));
      ff.stdin.end();
    });
  }
  await browser.close();
  return clips.map(c => path.join(outDir, `${c}.webm`));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const clips = process.argv.slice(2);
  const files = await makeFilms(clips, 'tests/e2e/films');
  console.log(files.join('\n'));
}
