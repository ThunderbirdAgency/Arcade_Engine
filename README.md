# ArcadeEngine · Credit’s Lair

A browser-based playable cartoon: watch the threat, respond with mouse, touch or keyboard, then watch the success or comic failure film. First chapter: The Golden Offer. Nine prerecorded, native 1080p films ship with the project (approximately 42 MB total; only the selected branches are played).

Live site: https://arcade-engine-chi.vercel.app
GitHub: https://github.com/ThunderbirdAgency/Arcade_Engine
Vercel project: Thunderbird Agency / arcade-engine; main is the production branch.

## Play

- `/`: Three cinematic encounters: falling gate, contract trap, dragon breath.
- Arcade: timed choices tied to the film's playback clock; three lives; checkpoint retries; no response is a miss.
- Guided: freezes the film at each move cue; unlimited retries.
- Click/tap the move buttons. Arrow keys or WASD select moves; Space ducks in the vault. P/Escape pauses. Sound and full-screen controls are available.
- `/story.html`: the original longer illustrated financial story with 30 paths and three endings, preserved separately.

## Develop and verify

No runtime dependencies. Node 22+.

```sh
npm run dev
npm run build
```

The static development server supports video range requests and the supervised browser preview. Vercel serves `dist`; the build command validates references, syntax, legacy story paths, and cinematic cue boundary decisions.

## Engine files

- `dist/arcade.js`: double video player, media loading, playback-clock cues, keyboard/mouse/touch controls, pause/resume, retries and ending.
- `dist/arcade-scenes.mjs`: scene rules, accepted moves, cue windows, lessons.
- `dist/arcade-media.json`: explicit scene-to-film mapping.
- `docs/VIDEO-PRODUCTION.json`: exact prompts, reference artwork and generation job identifiers for test and production runs.
- `docs/QA.md`: review results and material limits.

The financial lesson is fictional: inspect total cost, retain existing armor, preserve 1,000 coins, earn 400. It does not calculate a credit score or promise a lending outcome.

## Scope

This release is a complete short three-room chapter, not a feature-length game or a clone of copyrighted characters/assets. It uses original artwork with prerecorded branching video. It has no accounts, payments, hosted save files, analytics, editor UI or provider credentials in the browser. The checked-in scene data is the authoring interface. Progress lasts for the current browser visit.

Do not run generation automatically on page views. All generation takes place through the authorized production workflow; credits are consumed only when jobs are explicitly submitted.
