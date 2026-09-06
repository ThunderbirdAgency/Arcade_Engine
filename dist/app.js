import {initialState,applyEffect,ending} from './core.mjs';
import {scenes,artDescriptions} from './story.mjs';
const $=id=>document.getElementById(id);
let state=initialState(),sceneId=null,sound=false,audioContext=null,frame=0,arcadeStart=0,arcadePosition=0,arcadeRunning=false,busy=false,mediaToken=0;
const media={},localMedia={};
const val=x=>typeof x==='function'?x(state):x;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const speak=text=>{if(!sound||!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const voice=new SpeechSynthesisUtterance(text);voice.rate=.96;voice.pitch=.9;window.speechSynthesis.speak(voice);};
function chime(success=true){if(!sound)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audioContext??=new AC();audioContext.resume().catch(()=>{});const t=audioContext.currentTime;[0,1,2].forEach((n)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=(success?[392,494,587]:[220,196,165])[n];g.gain.setValueAtTime(0,t+n*.08);g.gain.linearRampToValueAtTime(.045,t+n*.08+.015);g.gain.exponentialRampToValueAtTime(.001,t+n*.08+.3);o.connect(g);g.connect(audioContext.destination);o.start(t+n*.08);o.stop(t+n*.08+.32);});}catch{}}
function stopArcade(){arcadeRunning=false;cancelAnimationFrame(frame);}
function showMedia(id){
 const token=++mediaToken,scene=scenes[id]||{art:'gate'},img=$('scene-image'),video=$('scene-video');
 video.onloadeddata=video.onerror=video.onended=video.ontimeupdate=null;video.pause();video.hidden=true;video.removeAttribute('src');video.load();
 img.src=`/assets/${scene.art}.webp`;img.alt=artDescriptions[scene.art];img.classList.remove('scene-change');void img.offsetWidth;img.classList.add('scene-change');
 $('mode-label').textContent='ILLUSTRATED PROTOTYPE';
 const clip=localMedia[id]||media[id];if(!clip)return;
 const entry=typeof clip==='string'?{src:clip}:clip;
 if(!entry.src)return;
 video.src=entry.src;video.loop=Boolean(entry.loop);video.muted=!sound;video.poster=img.src;
 const fallback=()=>{if(token!==mediaToken)return;video.hidden=true;$('mode-label').textContent='ILLUSTRATED PROTOTYPE';$('feedback').textContent='This clip could not play. The illustrated scene is available.';};
 video.onerror=fallback;
 video.onloadeddata=()=>{if(token!==mediaToken)return;video.hidden=false;$('mode-label').textContent=localMedia[id]?'LOCAL CLIP PREVIEW':'ANIMATED SCENE';video.play().catch(fallback);};
 // The scene's image remains underneath during load. Finished clips hold their last frame.
}
function render(id,{narrate=true}={}){
 stopArcade();sceneId=id;busy=false;const scene=scenes[id];
 $('start-screen').hidden=true;$('story-screen').hidden=false;$('ledger').hidden=false;$('restart').hidden=false;
 $('coins').textContent=state.coins.toLocaleString();$('debt').textContent=state.debt.toLocaleString();
 $('progress-label').textContent=`${state.decision} OF 3 DECISIONS MADE`;
 $('scene-kicker').textContent=scene.kicker;
 $('scene-title').textContent=val(scene.title);$('narrative').textContent=val(scene.text);
 const detail=val(scene.detail);$('detail').hidden=!detail;$('detail').innerHTML=detail||'';
 $('feedback').textContent='';$('choices').replaceChildren();$('action-area').hidden=!scene.action;
 showMedia(id);
 if(id==='ending')renderEnding();else if(scene.action)renderArcade();else{
  $('choices').className='choices'+(scene.choices.length===1?' one':'');
  scene.choices.forEach((c,i)=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<span class="number" aria-hidden="true">${i+1}</span><span><b>${escapeHtml(c.title)}</b><small>${escapeHtml(c.sub)}</small></span>`;b.onclick=()=>choose(c);$('choices').append(b);});
 }
 $('scene-title').focus({preventScroll:true});
 if(narrate)speak($('scene-title').textContent+'. '+$('narrative').textContent);
}
function choose(choice){if(busy)return;busy=true;chime();if(choice.effect)state=applyEffect(state,choice.effect);render(choice.next);}
function renderEnding(){
 const result=ending(state);$('scene-title').textContent=result.title;$('narrative').textContent=result.body;
 $('detail').hidden=false;$('detail').innerHTML=`<div class="ending-grid"><span>Available coins<b>${state.coins.toLocaleString()}</b></span><span>Still committed<b>${state.debt.toLocaleString()}</b></span><span>Contract inspected<b>${state.inspected?'Yes':'No'}</b></span></div><details><summary>Your path through the castle</summary><ol class="journey-list">${state.history.map(h=>`<li>${escapeHtml(h)}</li>`).join('')}</ol></details><p>This is a fictional financial adventure. Your choices explore total cost, timing, and reserves; they do not calculate a real credit score.</p>`;
 $('choices').className='choices';
 const replay=document.createElement('button');replay.className='choice';replay.innerHTML='<span class="number">↺</span><span><b>Try another path</b><small>See what a different choice changes</small></span>';replay.onclick=start;
 const film=document.createElement('button');film.className='choice';film.innerHTML='<span class="number">↗</span><span><b>Explore the film room</b><small>See the shots behind this chapter</small></span>';film.onclick=openStudio;
 $('choices').append(replay,film);$('feedback').textContent=result.subtitle;
}
function renderArcade(){
 $('choices').className='choices';$('action-area').innerHTML='<div class="action-box"><div class="action-copy">An optional timing challenge. Stop the moving line inside the gold zone. Misses cost no coins.</div><div id="meter" class="action-meter" aria-hidden="true"><div class="safe-zone"></div><div id="marker" class="marker"></div></div><div class="action-buttons"><button id="deflect" class="primary">Begin challenge</button><button id="skip-arcade" class="quiet">Continue without timing →</button></div><p id="arcade-status" class="action-copy" role="status">You can also use Space when the challenge begins.</p></div>';
 $('deflect').onclick=()=>{if(!arcadeRunning){arcadeStart=performance.now();arcadeRunning=true;$('deflect').textContent='Deflect!';$('arcade-status').textContent='Stop the line inside the gold zone.';frame=requestAnimationFrame(tick);}else attemptDeflect();};
 $('skip-arcade').onclick=finishArcade;
}
function tick(now){if(!arcadeRunning)return;arcadePosition=(Math.sin((now-arcadeStart)/450-Math.PI/2)+1)*50;$('marker').style.left=`calc(${arcadePosition}% - 2px)`;frame=requestAnimationFrame(tick);}
function attemptDeflect(){if(!arcadeRunning)return;const won=arcadePosition>=35&&arcadePosition<=65;stopArcade();if(won){chime();$('deflect').textContent='Collect the reward →';$('deflect').onclick=finishArcade;$('arcade-status').textContent='A perfect deflection. The dragon is reluctantly impressed.';}else{chime(false);$('deflect').textContent='Try again';$('arcade-status').textContent='The spark singes one eyebrow. It grows back immediately. Try again or continue.';}}
function finishArcade(){if(sceneId!=='vault'||busy)return;busy=true;stopArcade();state=applyEffect(state,'reward');chime();render('reward');}
function start(){state=initialState();render('arrival');}
$('play').onclick=()=>{chime();start();};
$('scene-image').onerror=()=>$('scenery').classList.add('media-error');$('scene-image').onload=()=>$('scenery').classList.remove('media-error');
$('sound-toggle').onclick=()=>{sound=!sound;$('sound-toggle').textContent=sound?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(sound));$('sound-toggle').title='Sound effects and device narration';$('scene-video').muted=!sound;if(sound){chime();if(sceneId)speak($('narrative').textContent);}else if('speechSynthesis' in window)window.speechSynthesis.cancel();};
$('replay-scene').onclick=()=>{showMedia(sceneId);speak($('scene-title').textContent+'. '+$('narrative').textContent);};
$('restart').onclick=()=>{stopArcade();$('restart-dialog').showModal();};
$('confirm-restart').onclick=()=>{$('restart-dialog').close();start();};
for(const b of document.querySelectorAll('.close-dialog'))b.onclick=()=>b.closest('dialog').close();
function openStudio(){stopArcade();if('speechSynthesis' in window)window.speechSynthesis.cancel();$('scene-video').pause();$('film-room').showModal();}
$('studio-open').onclick=openStudio;
$('film-room').addEventListener('close',()=>{for(const v of $('film-room').querySelectorAll('video'))v.pause();if(sceneId&&$('scene-video').src&&!$('scene-video').hidden)$('scene-video').play().catch(()=>{});if(sceneId==='vault')renderArcade();});
$('restart-dialog').addEventListener('close',()=>{if(sceneId==='vault')renderArcade();});
window.addEventListener('keydown',e=>{if(e.repeat||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.code==='Space'&&arcadeRunning){e.preventDefault();attemptDeflect();return;}if(/^[123]$/.test(e.key)){const b=$('choices').children[Number(e.key)-1];if(b){e.preventDefault();b.click();}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopArcade();$('scene-video').pause();if('speechSynthesis' in window)window.speechSynthesis.cancel();}else if(sceneId==='vault')renderArcade();});
async function copyPrompt(text){try{await navigator.clipboard.writeText(text);$('studio-status').textContent='Prompt copied.';}catch{$('studio-status').textContent='Clipboard unavailable. Open “Full prompt” to select the text, or download the prompt pack.';}}
async function loadStudio(){
 try{const response=await fetch('/production-pack.json');if(!response.ok)throw Error();const pack=await response.json();
 $('shot-count').textContent=pack.shots.length;$('footage-length').textContent=`${Math.floor(pack.shots.reduce((n,s)=>n+s.duration_seconds,0)/60)}m ${pack.shots.reduce((n,s)=>n+s.duration_seconds,0)%60}s`;
 for(const shot of pack.shots){
  const row=document.createElement('article');row.className='shot';row.innerHTML=`<a href="${shot.reference}" download aria-label="Download ${escapeHtml(shot.title)} reference"><img src="${shot.reference}" alt="${escapeHtml(shot.title)} reference artwork" loading="lazy"></a><div><p class="shot-meta">${escapeHtml(shot.id.toUpperCase())} / ${shot.duration_seconds} SECONDS</p><h3>${escapeHtml(shot.title)}</h3><p>${escapeHtml(shot.action)}</p><details><summary>Full prompt</summary><p>${escapeHtml(shot.prompt)}</p></details><div class="shot-actions"><button class="quiet copy">Copy prompt</button><a class="quiet" href="${shot.reference}" download>Reference ↓</a><label class="file-label">Preview a clip<input type="file" accept="video/mp4,video/webm" aria-label="Preview a video for ${escapeHtml(shot.title)}"></label><button class="quiet clear" hidden>Remove clip</button></div><div class="clip-preview"></div></div>`;
  row.querySelector('.copy').onclick=()=>copyPrompt(shot.prompt);
  const fileInput=row.querySelector('input'),clear=row.querySelector('.clear'),container=row.querySelector('.clip-preview');let pendingUrl=null;
  fileInput.onchange=()=>{const file=fileInput.files[0];if(!file)return;if(!/\.(mp4|webm)$/i.test(file.name)||file.size>250*1024*1024){$('studio-status').textContent='Choose an MP4 or WebM under 250 MB.';fileInput.value='';return;}
   const url=URL.createObjectURL(file);if(pendingUrl)URL.revokeObjectURL(pendingUrl);pendingUrl=url;const player=document.createElement('video');player.controls=true;player.playsInline=true;player.muted=true;player.preload='metadata';player.style.cssText='width:100%;max-height:260px;margin-top:16px;border-radius:4px';player.src=url;
   player.onloadedmetadata=()=>{if(pendingUrl!==url)return;const previous=localMedia[shot.id];if(previous)URL.revokeObjectURL(previous.src);localMedia[shot.id]={src:url};pendingUrl=null;clear.hidden=false;$('studio-status').textContent=`${shot.title}: clip ready for this visit. It will play when you reach this scene.`;if(sceneId===shot.id)showMedia(sceneId);};
   player.onerror=()=>{if(pendingUrl===url){URL.revokeObjectURL(url);pendingUrl=null;}$('studio-status').textContent='This video format could not be decoded. Try an H.264 MP4 or a WebM.';};container.replaceChildren(player);
  };
  clear.onclick=()=>{const old=localMedia[shot.id];delete localMedia[shot.id];if(old)URL.revokeObjectURL(old.src);container.replaceChildren();clear.hidden=true;fileInput.value='';if(sceneId===shot.id)showMedia(sceneId);$('studio-status').textContent='Local preview removed.';};$('shots').append(row);
 }
 }catch{$('studio-status').textContent='The film room could not load. Refresh to try again; the game is still playable.';}
}
fetch('/media.json').then(r=>r.ok?r.json():{}).then(entries=>{for(const [id,entry]of Object.entries(entries)){const src=typeof entry==='string'?entry:entry.src;if(!scenes[id]||typeof src!=='string')continue;try{const url=new URL(src,location.origin);if(url.origin===location.origin&&url.pathname.startsWith('/assets/'))media[id]=entry;}catch{}}}).catch(()=>{});
loadStudio();
