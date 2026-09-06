import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { scenes } from '../dist/story.mjs';
import { initialState, applyEffect, ending } from '../dist/core.mjs';
for (const file of ['dist/app.js','dist/story.mjs','dist/core.mjs','dist/arcade.js','dist/arcade-scenes.mjs','scripts/dev.mjs']) execFileSync(process.execPath,['--check',file]);
let paths=0;const reached=new Set(),outcomes=new Set();
function walk(id,state,path=[]){
 assert(path.length<25,'Unexpected story cycle');assert(scenes[id],`Unknown scene ${id}`);reached.add(id);
 assert(state.coins>=0&&state.debt>=0,'Invalid balance');
 if(id==='ending'){assert.equal(state.decision,3);outcomes.add(ending(state).title);paths++;return;}
 if(id==='vault'){walk('reward',applyEffect(state,'reward'),[...path,id]);return;}
 for(const c of scenes[id].choices) walk(c.next,c.effect?applyEffect(state,c.effect):state,[...path,id]);
}
walk('arrival',initialState());assert.equal(reached.size,Object.keys(scenes).length);assert.equal(outcomes.size,3);
let s=initialState();for(const e of ['cash','charm','repair','reward','pay'])s=applyEffect(s,e);assert.equal(s.coins,250);assert.equal(s.debt,0);
s=initialState();for(const e of ['borrow','reserve','repair','reward','pay'])s=applyEffect(s,e);assert.equal(s.coins,330);assert.equal(s.debt,0);
for(const scene of Object.values(scenes))assert(fs.existsSync(`dist/assets/${scene.art}.webp`));
const pack=JSON.parse(fs.readFileSync('dist/production-pack.json'));
for(const shot of pack.shots){assert(scenes[shot.id]);assert(fs.existsSync('dist'+shot.reference));}
const media=JSON.parse(fs.readFileSync('dist/media.json'));
for(const[id,entry]of Object.entries(media)){assert(scenes[id],`Unknown media scene ${id}`);const src=typeof entry==='string'?entry:entry.src;assert(typeof src==='string'&&src.startsWith('/assets/')&&!src.includes('..'));assert(fs.existsSync('dist'+src),`Missing video ${src}`);}
const html=fs.readFileSync('dist/index.html','utf8');for(const m of html.matchAll(/(?:href|src)="(\/(?!\/)[^"#?]*)"/g))if(m[1]!=='/')assert(fs.existsSync('dist'+m[1]),`Missing ${m[1]}`);
console.log(`ArcadeEngine verified: ${paths} complete paths, ${reached.size} scenes, ${outcomes.size} endings; assets and media manifest valid.`);

execFileSync(process.execPath,['scripts/test-arcade.mjs'],{stdio:'inherit'});
const films=JSON.parse(fs.readFileSync('dist/arcade-media.json'));
assert.equal(Object.keys(films.clips).length,9);
for(const e of Object.values(films.clips)){assert(e.src&&e.jobId);if(e.src.startsWith('/'))assert(fs.existsSync('dist'+e.src));else assert.equal(new URL(e.src).protocol,'https:');}
