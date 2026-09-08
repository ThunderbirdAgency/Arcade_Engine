# ArcadeEngine

Drop in a story, get a playable cartoon. ArcadeEngine turns a story file into a Dragon’s Lair-style interactive film:
watch the scene, hit the right move at the right moment, and the film branches to the outcome. The same engine builds the
shot list, locks every prompt to the world bible, hands the jobs to Higgsfield, ingests the films, reviews them for
continuity, and ships the game as static files.

First game: **Credit’s Lair · The Golden Offer**, nine native 1080p films.

Live site: https://arcade-engine-chi.vercel.app · GitHub: https://github.com/ThunderbirdAgency/Arcade_Engine ·
Vercel: Thunderbird Agency / arcade-engine, `main` is production.

## Play

* `/` plays the default game; `/?game=<slug>` picks another. The title card lists every playable title.
* Arcade: timed moves on the film clock, three lives, checkpoint retries, a miss is a miss.
* Guided: the film holds at every cue, unlimited time, no lives.
* Mouse, touch, or keyboard: arrows or WASD for directions, Space/Enter for action. P or Escape pauses.
* `/story.html`: the original illustrated financial story with 30 paths and three endings, preserved as-is.

## How it fits together

```
stories/<slug>/story.mjs   world bible + node graph            (you write this)
        │  compile + lint (pipeline/compile.mjs, lint.mjs, prompts.mjs)
        ├─► dist/games/<slug>/game.json      runtime data for the player
        └─► stories/<slug>/shots.json        every film with its locked prompt and hash
                │  pack (pipeline/pack.mjs)
                └─► stories/<slug>/pack.json  provider-ready jobs: keyframes, character sheets, films in dependency order
                        │  generate: Higgsfield session (MCP, Seedance 2.5) or HTTP API
                        │  ingest:   download, probe, last frame, media.json
                        │  review:   contact sheets + congruency verdicts (Claude) or a human checklist
                        └─► films in dist, game becomes playable
engine/core.mjs    pure state machine (graph, beats, moves, lives, checkpoints)   engine/player.mjs   browser cabinet
```

* [docs/STORY-FORMAT.md](docs/STORY-FORMAT.md): the story format, node types, beats, moves, branching, lint rules.
* [docs/PIPELINE.md](docs/PIPELINE.md): compile, pack, generate, ingest, review, stitch; providers; costs.
* [docs/QA.md](docs/QA.md): what was verified and how.

## Develop and verify

No runtime dependencies. Node 22+.

```sh
npm run dev                          # static preview on :4173 with range requests
npm test                             # syntax check, unit tests, build every story, integrity checks (Vercel build command)
npm run unit                         # engine, compiler and pipeline tests only
npm run story -- <slug> status       # lint | compile | status | plan | pack | ingest | review | stitch | golden
npm run e2e                          # real-browser run of the player (needs the optional playwright package)
```

Optional packages: `@anthropic-ai/sdk` enables automatic film review; `playwright` enables browser tests and frame
extraction without ffmpeg. Neither ships to the browser.

## Adding a title

1. Copy `stories/lantern-bridge/story.mjs` (a complete demo: branching, four-way moves, multi-beat clips, a unique
   failure film per wrong move, chapter cards, two endings) to `stories/<slug>/story.mjs` and write your story.
2. `npm run story -- <slug> lint` until clean, then `plan` to read every prompt the engine will send.
3. `pack`, submit the jobs in a Higgsfield-connected session, write `results.json`, `ingest`, `review`.
4. `npm test` builds it; the game appears on the title card as soon as every film is present.

## Scope and rules

Original artwork and characters only. No accounts, payments, analytics or provider credentials in the browser. The checked-in
story files are the authoring interface. Progress lasts for the current visit. Generation never runs on page views: films are
made only when jobs are explicitly submitted, and every job id and prompt is recorded in `media.json`.

The financial lesson in Credit’s Lair is fictional and does not calculate a credit score or promise a lending outcome.
