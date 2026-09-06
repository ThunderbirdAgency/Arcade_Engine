# ArcadeEngine

ArcadeEngine turns prerecorded animation and video into playable branching experiences. **Credit’s Lair** is the first game, featuring original painted fantasy artwork and financial decision scenarios.

## Current release

The first release contains a playable illustrated chapter, 14 scene prompts, three original art references, choices with consequences, coin/debt state, three endings, and an optional arcade timing challenge. The Film room previews local MP4/WebM clips and provides the production prompts.

The final Dragon’s Lair-style engine is still in development. Video-synchronized input windows, seamless outcome cuts, animated failure/retry clips, and persistent checkpoints are planned. The existing timing challenge is separate from the video timeline. No Higgsfield generation has run for this release.

## Vercel

Import this repository as **Other**, keep the root directory at the repository root, and use `dist` as the output directory. `vercel.json` supplies the build settings. `node scripts/verify.mjs` checks the story graph, game arithmetic, local assets and video manifest before deployment. No dependencies or environment variables are required to play the prototype.

Once the Vercel project is connected to this GitHub repository, main-branch pushes can trigger production deployments and pull requests can receive preview deployments.

## Project layout

- `dist/index.html`, `dist/style.css`: the game and Film room interface.
- `dist/app.js`: playback, choices, local preview, sound and device narration.
- `dist/story.mjs`: scenes, dialogue, choices and branch destinations.
- `dist/core.mjs`: deterministic state updates and outcome rules.
- `dist/assets/`: original game illustrations and future approved video clips.
- `dist/production-pack.json`: shot prompts, timing, references and continuity guidance.
- `dist/media.json`: scene-to-video mappings, initially empty.
- `scripts/verify.mjs`: release verification.

## Animation connection

The Higgsfield connection runs separately from the public game. Use an authorized Higgsfield plugin or server-side API connection, inspect account/model access, generate a first short reference-conditioned clip, check the output, then continue the shot list. Never put provider keys in the player, GitHub, or prompt pack.

After approving a clip, download it into `dist/assets/`, add its scene mapping to `dist/media.json`, and run `npm run check`. The Film room’s browser previews are temporary and do not publish files.

See `docs/ANIMATION-PRODUCTION.md` and `docs/CONNECTION-STATUS.md` for the production workflow and remaining connections.

## Learning scope

Game amounts and contract terms are fictional and explicit. The experience explores total cost, timing, and cash reserves. It does not calculate real credit scores or lending eligibility. Game progress is currently in memory for the current visit only.

## Verification limits

The graph and arithmetic checks cover all 30 paths and three endings. Automated browser QA and video-generation integration testing have not yet been performed. Current art is still illustration with camera movement, not finished character animation.
