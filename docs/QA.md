# Credit’s Lair 1.0 — verification

Date: 2026-09-06. Scope: original three-room playable cartoon in ArcadeEngine.

## Video review

Nine 720p test films were generated and inspected as one-second contact sheets before the HD upgrade. Nine final films were generated natively at 1920 × 1080 with the high-bitrate setting; one rejected gate setup was replaced with a gentler shot. All nine final films were inspected for character continuity, readable actions and appropriate success/failure outcomes. The final files are H.264/yuv420p plus AAC, approximately six seconds each, with fast-start metadata. They retain native 1080p dimensions; this is not an upscale of the 720p tests. Metadata is recorded in hd-video-metadata.json.

Gate: stone lands on the right, knight escapes left or suffers a comic dust-and-tumble setback. Merchant: long contract unfolds, inspection avoids the purchase, or paper wraps the knight. Dragon: breath warning, duck escape and gold reward, or sword-up smoke setback. Original background artwork and teal-cloaked knight are retained. Independent shots have visible cuts and some pose/camera variation; these are not frame-perfect seamless transitions.

## Engine verification

Automated checks pass for the three move rules, early input, inclusive cue boundaries, late input and wrong input. Existing illustrated story checks still pass: 30 complete paths, 14 scenes and three endings, with fictional coin arithmetic and asset references validated.

Browser checks covered mouse and keyboard choices, all three test failure branches, checkpoint retries, the full successful quest and the 300-point/1,400-coin ending. Arcade no-input timeouts deducted one life each; three misses produced the out-of-lives screen; a new quest restored three lives. Pause held the video clock at exactly 2.449131 seconds across separate observations, then resumed. Sound toggle updated the player control. Guided mode stopped at each cue. HD gate success, merchant success/failure and dragon failure were replayed with local final files. The player reported 1920 × 1080 for HD playback.

A 390 × 844 browser frame was visually checked with title and move buttons visible and clickable. This is responsive-layout verification, not physical iPhone/Safari certification. Audio streams are present; sound quality has not been assessed by a listening panel. No promise of exhaustive browser compatibility is made.

## Release scope

This is a short, complete three-room chapter. There is no editor UI, cloud save, account system or analytics. Decisions follow authored move rules; lessons and coins are fictional. Videos are stored with the application and do not generate on page views.
