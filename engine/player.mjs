// Browser player: binds the pure engine to two <video> elements and the cabinet UI.
// Loads /games/index.json, picks a game (?game=slug), fetches its game.json and runs it.
import { createEngine, moveForKey } from './core.mjs';

const $ = id => document.getElementById(id);
const videos = [$('film-a'), $('film-b')];
let game = null, engine = null, active = null, token = 0, raf = 0, muted = false, paused = false, holding = false, started = false, currentBeat = null;
let prefetched = new Set();

const setStatus = t => { $('status').textContent = t; };
const toast = t => { $('toast').textContent = t; };

function button(text, fn, secondary = false) {
  const b = document.createElement('button');
  b.textContent = text; b.className = secondary ? 'secondary' : 'gold';
  b.onclick = () => { b.disabled = true; fn(); };
  return b;
}
function modal(kicker, title, copy, actions, extra) {
  $('overlay-kicker').textContent = kicker || '';
  $('overlay-title').textContent = title || '';
  $('overlay-copy').textContent = copy || '';
  $('overlay-extra').replaceChildren(...(extra || []));
  $('overlay-actions').replaceChildren(...actions);
  $('overlay').hidden = false;
  $('overlay-title').focus({ preventScroll: true });
}
const closeModal = () => { $('overlay').hidden = true; };

function clipSrc(id) {
  const entry = game.clips?.[id];
  if (!entry?.src) throw Error(`Missing film: ${id}`);
  const u = new URL(entry.src, location.origin);
  if (u.protocol !== 'https:' && u.origin !== location.origin) throw Error('Invalid film address');
  return u.href;
}

function prefetch(clips) {
  for (const id of clips) {
    if (prefetched.has(id) || !game.clips?.[id]) continue;
    prefetched.add(id);
    const link = document.createElement('link');
    link.rel = 'prefetch'; link.as = 'video'; link.href = clipSrc(id);
    document.head.append(link);
  }
}

function failMedia(message) {
  cancelAnimationFrame(raf); active?.pause();
  $('cue-panel').hidden = true; $('pause').hidden = true;
  modal('THE FILM NEEDS A MOMENT', 'Let’s try that again.', message, [
    button('Reload this scene', () => location.reload()),
  ]);
}

async function playClip(id, nodeId) {
  const mine = ++token;
  cancelAnimationFrame(raf);
  holding = false; currentBeat = null;
  $('cue-panel').hidden = true; closeModal(); toast('Loading the film…'); $('pause').hidden = true;
  const poster = game.nodes[nodeId]?.poster; if (poster) $('poster').src = poster;
  const next = videos.find(v => v !== active) || videos[0];
  next.pause(); next.onended = null; next.onerror = null; next.muted = muted; next.loop = false;
  try {
    next.src = clipSrc(id); next.load();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(Error('The film took too long to load. Check your connection and reload.')); }, 30000);
      const cleanup = () => { clearTimeout(timeout); next.removeEventListener('canplay', ok); next.removeEventListener('error', bad); };
      const ok = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(Error('This film could not be played. Please reload.')); };
      next.addEventListener('canplay', ok); next.addEventListener('error', bad);
      if (next.readyState >= 3) ok();
    });
    if (mine !== token) return;
    active?.pause(); videos.forEach(v => { v.hidden = v !== next; }); active = next;
    toast(''); $('pause').hidden = false; $('pause').textContent = 'Pause Ⅱ';
    active.onerror = () => { if (mine === token) failMedia('The film was interrupted. Reload to continue from your checkpoint.'); };
    active.onended = () => { if (mine === token) render(engine.clipEnded()); };
    render(engine.clipLoaded(active.duration || 0));
    try { await active.play(); } catch { pauseGame(true); return; }
    if (mine !== token) return;
    if (document.hidden) { pauseGame(); return; }
    raf = requestAnimationFrame(tick);
  } catch (err) { if (mine === token) failMedia(err.message); }
}

function tick() {
  if (paused || !active) return;
  render(engine.tick(active.currentTime));
  if (engine.state.phase === 'playing' && !holding) raf = requestAnimationFrame(tick);
}

const AREA = { up: 'up', down: 'down', left: 'left', right: 'right', action: 'action' };
function showCue(e) {
  currentBeat = e.beat;
  $('cue-text').textContent = e.beat.cue;
  $('countdown').hidden = e.hold;
  $('time-bar').style.transform = 'scaleX(1)';
  $('moves').replaceChildren(...e.moves.map(m => {
    const b = document.createElement('button');
    b.className = 'move'; b.style.gridArea = AREA[m.key] || 'action';
    b.onclick = () => input(m.id);
    const icon = document.createElement('span'); icon.className = 'icon'; icon.textContent = m.icon; icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('b'); label.textContent = m.label;
    b.append(icon, label);
    return b;
  }));
  $('cue-panel').hidden = false;
  if (e.hold) { holding = true; active.pause(); setStatus('GUIDED MODE · CHOOSE WHEN READY'); }
}

function input(id) {
  if (paused) return;
  const fx = engine.input(id);
  render(fx);
  // A rolling hit in guided mode: the film was held at the cue, so resume it.
  if (holding && !fx.some(f => f.type === 'play') && engine.state.phase === 'playing') {
    holding = false; active.play().catch(() => pauseGame(true)); raf = requestAnimationFrame(tick);
  }
}

function hud(e) {
  $('chapter').textContent = e.chapter || game.episode || '';
  const guided = engine.state.mode === 'guided';
  $('lives').textContent = guided ? `GUIDED · ${e.score} POINTS` : `${'◆'.repeat(e.lives)}${'◇'.repeat(Math.max(0, engine.rules.lives - e.lives))} · ${e.score} POINTS`;
}

function render(fx) {
  for (const e of fx) {
    switch (e.type) {
      case 'play': playClip(e.clip, e.nodeId); setStatus(e.kind === 'scene' ? 'WATCH THE SCENE · WAIT FOR YOUR CUE' : e.kind === 'death' ? 'A COMEDIC SETBACK' : 'GOOD MOVE'); break;
      case 'prefetch': prefetch(e.clips); break;
      case 'cue': showCue(e); break;
      case 'timer': $('time-bar').style.transform = `scaleX(${e.left})`; $('countdown').setAttribute('aria-valuenow', String(Math.round(e.left * 100))); break;
      case 'cueOff': $('cue-panel').hidden = true; currentBeat = null; break;
      case 'judge': setStatus(e.verdict === 'hit' ? 'GOOD MOVE' : e.verdict === 'miss' ? 'TOO SLOW' : 'WRONG MOVE'); break;
      case 'early': toast('Watch closely. The move cue is coming.'); break;
      case 'hud': hud(e); break;
      case 'card': modal(e.node.text.kicker, e.node.text.title, e.node.text.body, [button('Continue →', () => render(engine.advance()))]); break;
      case 'text': modal(e.node.text?.kicker, e.node.text?.title, e.node.text?.body, [button('Continue →', () => render(engine.advance()))]); break;
      case 'death': $('pause').hidden = true; modal(e.node.text?.kicker || 'A SETBACK', e.node.text?.title || 'Try a different move.', e.node.text?.body || '', [button('Retry ↺', () => render(engine.advance()))]); break;
      case 'gameover': $('pause').hidden = true; modal('OUT OF LIVES', 'The story wins. This time.', `${e.node.text?.title || ''} Start again with fresh lives, or practice from your checkpoint without a timer.`, [button('Start a new run', start), button('Practice from checkpoint', () => render(engine.practice()), true)]); break;
      case 'ending': ending(e); break;
      case 'cut': break;
    }
  }
}

function ending(e) {
  $('pause').hidden = true; $('room-count').textContent = 'COMPLETE';
  setStatus(`${game.title.toUpperCase()} · POWERED BY ARCADEENGINE`);
  const s = e.summary;
  const stats = document.createElement('p'); stats.className = 'stats';
  stats.textContent = `${s.score} points · ${s.hits} good moves · ${s.deaths} setback${s.deaths === 1 ? '' : 's'}`;
  const recap = document.createElement('ul'); recap.className = 'recap';
  for (const line of s.recap) { const li = document.createElement('li'); li.textContent = line; recap.append(li); }
  const actions = [button('Play again ↺', start)];
  for (const l of game.links || []) actions.push(button(l.label, () => { location.href = l.href; }, true));
  modal(e.node.text?.kicker, e.node.text?.title, e.node.text?.body, actions, [stats, recap]);
}

function start() {
  engine = createEngine(game, { mode: $('difficulty').value });
  started = true; paused = false; prefetched = new Set();
  $('title-card').hidden = true; $('cabinet').classList.add('in-game'); $('lives').hidden = false; $('restart').hidden = false;
  $('room-count').textContent = game.episode || '';
  closeModal();
  render(engine.start());
}

function pauseGame(blocked = false) {
  if (!engine || paused || engine.state.phase !== 'playing') return;
  paused = true; active?.pause(); cancelAnimationFrame(raf);
  $('cue-panel').hidden = true; $('pause').textContent = 'Resume ▶';
  modal('INTERMISSION', blocked ? 'Ready when you are.' : 'Take a breath.', 'The film and your move timer are paused.', [button('Resume the film ▶', resume)]);
}
async function resume() {
  if (!paused) return;
  paused = false; closeModal(); $('pause').textContent = 'Pause Ⅱ';
  if (currentBeat) $('cue-panel').hidden = false;
  try { if (!holding) await active.play(); raf = requestAnimationFrame(tick); } catch { pauseGame(true); }
}

function bind() {
  $('start').onclick = start;
  $('pause').onclick = () => paused ? resume() : pauseGame();
  $('sound').onclick = () => { muted = !muted; videos.forEach(v => { v.muted = muted; }); $('sound').textContent = muted ? 'Sound off' : 'Sound on'; $('sound').setAttribute('aria-pressed', String(!muted)); };
  $('restart').onclick = () => { if (!engine) return; const wasPaused = paused; if (!wasPaused) pauseGame(); modal('START OVER?', 'Return to the beginning?', 'This resets your current run and restores your lives.', [button('Restart', start), button('Keep playing', () => wasPaused ? closeModal() : resume(), true)]); };
  $('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Full screen is unavailable in this browser.'); } };
  window.addEventListener('keydown', e => {
    if (e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === 'escape' || key === 'p') { if (engine && (paused || engine.state.phase === 'playing')) { e.preventDefault(); paused ? resume() : pauseGame(); } return; }
    if (!engine || paused || engine.state.phase !== 'playing') return;
    if (!currentBeat) { if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) { e.preventDefault(); render(engine.input('none')); } return; }
    const id = moveForKey(currentBeat, key);
    if (id) { e.preventDefault(); input(id); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && started) pauseGame(); });
}

async function loadGame() {
  const index = await (await fetch('/games/index.json', { cache: 'no-cache' })).json();
  const wanted = new URLSearchParams(location.search).get('game');
  const pick = index.games.find(g => g.slug === wanted) || index.games.find(g => g.playable) || index.games[0];
  if (!pick) throw Error('No games are installed.');
  game = await (await fetch(`/games/${pick.slug}/game.json`, { cache: 'no-cache' })).json();
  document.title = `${game.title} · ArcadeEngine`;
  $('title-eyebrow').textContent = game.episode || 'A PLAYABLE CARTOON';
  $('title-name').innerHTML = '';
  const words = game.title.split(' ');
  $('title-name').append(words.slice(0, -1).join(' '), document.createElement('br'));
  const em = document.createElement('em'); em.textContent = words.at(-1); $('title-name').append(em);
  $('title-tagline').textContent = game.tagline || '';
  $('chapter').textContent = game.episode || '';
  $('disclaimer').textContent = game.disclaimer || '';
  if (game.poster) $('poster').src = game.poster;
  const others = index.games.filter(g => g.slug !== game.slug && g.playable);
  $('other-games').replaceChildren(...others.map(g => { const a = document.createElement('a'); a.href = `/play/?game=${g.slug}`; a.textContent = `Play ${g.title} ↗`; a.className = 'archive'; return a; }));
  $('links').replaceChildren(...(game.links || []).map(l => { const a = document.createElement('a'); a.href = l.href; a.textContent = `${l.label} ↗`; a.className = 'archive'; return a; }));
  if (!game.playable) { $('start').disabled = true; toast('This story has no films yet. Run the production pipeline to generate them.'); }
}

bind();
loadGame().catch(err => failMedia(err.message));
