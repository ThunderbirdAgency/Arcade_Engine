> Current cinematic release: see VIDEO-PRODUCTION.json, arcade-media.json and QA.md. The earlier illustrated-story production notes below are retained for reference.

# Animation production

The downloadable prompt pack is in dist/production-pack.json. It contains 14 clip briefs totaling 97 seconds before optional variants.

The current release is an illustrated, playable prototype; no generated motion footage or Higgsfield integration is present. The Film room allows local browser preview of actual MP4/WebM files. Clips are not uploaded or persisted.

## Permanent clips

Place each approved H.264 MP4 or WebM under dist/assets/. Map it by scene id in dist/media.json, for example:

```json
{"offer": {"src": "/assets/offer.mp4", "loop": false}}
```

The engine renders the still poster while footage loads, plays the footage, and holds the last frame. If video playback fails it retains the illustrated scene and keeps choices available. Use loop only for a deliberately seamless waiting shot. Replay scene never reapplies gameplay effects.

## Final production

Approve consistent character sheets and new bridge/peddler keyframes. Golden-armor and original-armor continuity will require branch-specific final clips or neutral framing. Prompts alone do not guarantee continuity. Replace device narration with directed voice tracks for a finished cartoon.

Account access and credit budget must be established through an available authorized Higgsfield/API connection before automated generation. Do not place API keys in browser code. This static project intentionally contains no provider credentials or unverified API endpoints.

Model reference: https://higgsfield.ai/blog/seedance-2-5-on-higgsfield-2026 (reviewed 2026-09-05). Provider documentation states up to 30 seconds for Seedance 2.5; plan availability may differ.
