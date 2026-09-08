// Condensed story-format rules handed to the drafting model. Keep in step with docs/STORY-FORMAT.md.
export const FORMAT_GUIDE = `STORY FORMAT (JSON object):
{ slug, title, episode, tagline, description, poster: <location id>, disclaimer?, links?: [{label, href}],
  style: { look: <visual bible every prompt starts with>, rules: <no text, one continuous shot, etc>, safety },
  production: { provider: 'higgsfield-session', model: 'seedance_2_5', mode: 'omni_reference', duration: 4-12, resolution: '1080p', aspect: '16:9', audio: true, bitrate: 'high', continuity: { startFrame: 'previous'|'location', characterReferences: true, videoReference: true } },
  characters: { <id>: { name, description: <locked visual description>, rules?: <what must never change>, states?: { <state>: <description after a change> } } },
  locations: { <id>: { name, description: <locked description>, keyframe: '/games/<slug>/keyframes/<id>.webp' } },
  rules: { lives: 3, scoring: { move: 100, scene: 250, ending: 1000 }, checkpoints: 'scene' },
  start: <node id>,
  nodes: { <id>: node } }
Ids: lowercase letters, digits and dashes only. Cast entries are character ids, optionally 'id@state'.
Node types:
- scene: { type:'scene', chapter, location, cast, shot:{action, ends}, beats:[...], next?, miss?, checkpoint?, recap?, transition? } interactive film.
- cut:   { type:'cut', location, cast, shot, text?:{kicker,title,body}, next } non-interactive film, optional card after it.
- death: { type:'death', location, cast, shot, text:{kicker,title,body}, retry? } costs a life, returns to retry or the last scene.
- card:  { type:'card', text:{kicker,title,body}, next } text only.
- ending:{ type:'ending', text:{kicker,title,body} }.
Beat: { at:[open, close] fractions of the clip (0 <= open < close <= 1, windows must not overlap, at least 0.35s wide), cue: <text the player reads>,
  moves: { <move>: { label?, to?: <node> } } correct moves (to = cut to that node now; without to the film keeps rolling to the next beat then scene.next),
  decoys?: { <move>: { label } } wrong moves shown as buttons, wrong?: { <move>: <death node> } a specific death per wrong move, miss: <death node> for timeouts and other wrong input }.
Moves are up, down, left, right, action, or a custom id with key set to one of those. Two moves in one beat may not share a key.
A scene whose last beat has a correct move without 'to' must have scene.next. Every node must reach an ending. Scenes that change location from the previous filmed node need transition:true or a card between.
Shot writing: shot.action describes what the film shows second by second in one continuous take, naming characters by name and stating which side of frame the danger is on; shot.ends says how it ends (scenes end on suspense before the outcome; cuts end positioned for the next scene; deaths hold a comic pose).`;
