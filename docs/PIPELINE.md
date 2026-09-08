# Production pipeline

Drop in a story, get films. Every stage is a command; nothing runs on page views and credits are only spent
when jobs are explicitly submitted.

```
node scripts/story.mjs <slug> lint      # continuity + structure rules
node scripts/story.mjs <slug> status    # which films exist, are missing, or drifted from their prompt
node scripts/story.mjs <slug> plan      # human-readable shot list: prompts, references, verify checklist
node scripts/story.mjs <slug> pack      # provider-ready job pack (stories/<slug>/pack.json)
node scripts/story.mjs <slug> ingest    # results.json → download, probe, hash, last frame → media.json
node scripts/story.mjs <slug> review    # contact sheets + congruency review → media.json + review/checklist.md
node scripts/story.mjs <slug> stitch    # golden path MP4 (needs ffmpeg with H.264)
npm test                                # build + verify everything
```

## 1. Compile

`pipeline/compile.mjs` lints the story, builds one locked prompt per filmed node (`pipeline/prompts.mjs`), hashes it
together with the model settings, and compares against `media.json`. A film is **ready** when its file exists, **missing**
when it does not, and **drifted** when the prompt it was made from no longer matches the story (the build still passes;
`status` shows `↻`).

## 2. Pack

`pipeline/pack.mjs` writes two stages:

* **assets**: `generate_image` requests for every location without a keyframe and every character without a sheet or
  reference element. Sheets become Higgsfield reference elements (`show_reference_elements action=create`) whose id is
  stored as `characters.<id>.element`.
* **films**: one `generate_video_batch` request per missing film, in dependency order. Medias are attached according to
  `production.continuity`: `start_image` (location keyframe or the previous film’s last frame), `image_references`
  (cast sheets), `video_references` (the previous film). Placeholders like `{{clip:riverbank:last}}` are resolved at
  submission time from `media.json` and the extracted frames.

Each film request carries a `verify` checklist derived from the bible: cast descriptions, location, no-text rule, one
continuous shot, and a kind-specific check (scenes end on suspense; deaths are comic and harmless; cuts end positioned
for the next scene).

## 3. Generate

Two providers:

* **higgsfield-session** (default, how the first nine films were made): a Higgsfield-connected Claude session submits the
  pack with the MCP tools (`generate_image`, `generate_video_batch`, `jobs_wait`, `show_reference_elements`) and writes
  `stories/<slug>/results.json` as `{ jobs: [{ id, jobId, url, model }] }`. This is the route to Seedance 2.5 with
  omni references, high bitrate and native audio.
* **higgsfield-api** (`pipeline/providers/higgsfield-api.mjs`): the public HTTP API (`api.higgsfield.ai`, header
  `Authorization: Key <id>:<secret>`, Seedance v1 image-to-video routes, `/requests/{id}/status` polling, `video.url` on
  completion). Set `HIGGSFIELD_KEY_ID` and `HIGGSFIELD_KEY_SECRET` in the environment; never in the repo.

## 4. Ingest

`pipeline/ingest.mjs` downloads each result into `dist/games/<slug>/films/`, probes it with a dependency-free MP4 reader
(duration, size, fast-start), extracts the last frame for chaining (`ffmpeg` if present, else headless Chromium via
Playwright), and records job id, source URL, prompt hash and a `review: pending` mark in `media.json`. Duration drift and
non-fast-start files are reported.

## 5. Review (congruency and consistency)

`pipeline/review.mjs` samples five frames per film into `stories/<slug>/review/frames/` and grades them against the film’s
verify checklist. With the `@anthropic-ai/sdk` package and an `ANTHROPIC_API_KEY` (or `ant auth login` profile) the
grading is automatic: Claude Fable 5.1 (override with `ARCADE_REVIEW_MODEL`) returns `{ pass, confidence, issues, fix }` as structured JSON and the verdict is written to
`media.json` (`review.status: approved | rejected`, with the suggested prompt amendment for a regeneration). Without a
reviewer model, `review/checklist.md` is written for a human pass. In a Higgsfield-connected session, `video_analysis_create`
can add a scene-by-scene description as a second opinion.

Rejected films: append the `fix` line to the node’s `shot.extra`, re-run `pack --only <clip>`, regenerate, ingest, review.

## 6. Stitch

`pipeline/stitch.mjs` concatenates the golden path (every correct move) into `stories/<slug>/golden-path.mp4` for a
continuity watch-through and a trailer. Needs an ffmpeg with H.264 on PATH.

## Costs

Each film is one generation. Credit’s Lair’s nine 1080p Seedance 2.5 films cost 837 credits including one replacement.
Plan on roughly 90 to 100 credits per 6-second 1080p film at high bitrate, so a 40-film chapter is on the order of 4,000 credits
plus a few regenerations. `generate_video` accepts `get_cost: true` to preflight a single request.
