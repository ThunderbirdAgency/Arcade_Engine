# ArcadeEngine story format

A story is one file, `stories/<slug>/story.mjs`, that exports a plain object. The engine compiles it into a
playable game (`dist/games/<slug>/game.json`) and a production shot list (`stories/<slug>/shots.json`).
Nothing else is needed to add a title: no engine code changes, no HTML.

```
stories/<slug>/
  story.mjs      the story (world bible + graph)          ← you write this
  media.json     which films exist, from which job, hash   ← the pipeline writes this
  shots.json     compiled shot list with locked prompts    ← compiled
  pack.json      provider-ready job pack                   ← `story <slug> pack`
  review/        contact sheets and the review checklist   ← `story <slug> review`
dist/games/<slug>/
  game.json      runtime data
  films/*.mp4    ingested films (Credit’s Lair keeps its films under /assets/films)
  keyframes/*.webp  location keyframes
```

## Top level

| key | meaning |
|---|---|
| `slug` | lowercase id, must equal the folder name |
| `title`, `episode`, `tagline`, `description` | title card copy |
| `poster` | location id whose keyframe is the title art |
| `disclaimer` | small print under the cabinet |
| `links` | `[{label, href}]` extra buttons on the title card and ending |
| `style` | `look` (the visual bible every prompt starts with), `rules` (no text, one shot…), `safety` |
| `production` | `provider`, `model`, `mode`, `duration`, `resolution`, `aspect`, `audio`, `bitrate`, `imageModel`, `continuity` |
| `characters` | `id → { name, description, rules, sheet, element, states }` |
| `locations` | `id → { name, description, keyframe, mood }` |
| `rules` | `lives` (3), `scoring: {move, scene, ending}`, `checkpoints: 'scene'`, `earlyIsWrong` (false) |
| `start` | first node id |
| `nodes` | the graph |

`production.continuity` controls how films are chained for consistency:
`startFrame: 'location' | 'previous'` (start image is the location keyframe, or the last frame of the film that leads here),
`characterReferences: true` (attach every cast member’s sheet as `image_references`),
`videoReference: true` (attach the previous film as `video_references`).

Character `states` let a costume change be locked: `states: { gold: 'the knight in gleaming golden armor' }`
and then `cast: ['knight@gold']` on the nodes after the change. The linter refuses undeclared states.

## Nodes

Every filmed node has `location`, `cast`, and a `shot: { action, ends }`. The film prompt is built as
`style.look` + locked descriptions of cast and location + `style.rules` + `style.safety` + character rules +
duration + `shot.action` + `shot.ends`. The clip id defaults to the node id (`clip:` overrides it).

| type | fields | behaviour |
|---|---|---|
| `scene` | `beats`, `next`, `miss`, `chapter`, `checkpoint`, `recap`, `transition` | interactive film with one or more move windows |
| `cut` | `next`, `text` | non-interactive film; if `text` is present a card is shown after it |
| `death` | `text`, `retry` | costs a life, then returns to `retry` or the last checkpoint |
| `card` | `text`, `next` | text-only interstitial (chapter titles, narration) |
| `ending` | `text`, optional `clip` | shows the ending screen with score and recap |

### Beats

```js
beats: [
  { at: [0.2, 0.4], cue: 'Missing plank. Jump!',
    moves: { up: { label: 'Jump' } },                 // correct moves; `to` cuts to another node immediately
    decoys: { down: { label: 'Duck' } },              // shown as buttons but wrong
    wrong: { down: 'bridge-fall' },                   // a specific film for a specific wrong move
    miss: 'bridge-fall' },                            // timeout and any other wrong input
  { at: [0.6, 0.85], cue: 'Lantern rope. Duck!', moves: { down: {} }, miss: 'bridge-clothesline' },
]
```

* `at` is a fraction of the clip (`unit: 'seconds'` for absolute times). Windows are inclusive and must not overlap.
* Move ids are `up`, `down`, `left`, `right`, `action`, or any custom id with `key` set to one of those.
  `keys: [' ']` adds extra keyboard keys. Icons and labels default sensibly.
* A correct move with `to` cuts to that node now (Dragon’s Lair style branch). Without `to`, the film keeps rolling to the
  next beat and finally to `scene.next`. Both can mix in one scene.
* Two correct moves in one beat with different `to` targets is a branch.
* Any input not listed in `moves` is wrong: `wrong[move]`, else `beat.miss`, else `scene.miss`.
* Guided mode holds the film at the cue and never times out. Arcade mode uses lives.

## Lint rules

`node scripts/story.mjs <slug> lint` reports rule ids:

* **S** story identity; **N** node structure and dangling edges; **B** beats (windows, keys, miss targets, rolling beats);
* **G** graph: unreachable nodes, dead ends (G2), no ending, no scene;
* **C** continuity: unknown location/character (C1/C2), undeclared state (C3), text in a shot (C4), location jump without a
  card or `transition: true` (C5);
* **D** death retries; **T** missing text; **M** clip id collisions.

Errors fail the build. Warnings print and pass.
