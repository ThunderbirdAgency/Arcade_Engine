// Credit’s Lair · Episode 01 “The Golden Offer”
// The first title, migrated to the ArcadeEngine story format. Nine finished 1080p films exist for it.
export default {
  slug: 'credits-lair',
  title: 'Credit’s Lair',
  episode: 'EPISODE 01 · THE GOLDEN OFFER',
  tagline: 'A brave knight. A very long contract. A dragon with expensive taste.',
  description: 'Watch the danger, make your move, and survive the golden offer.',
  poster: 'gate',
  disclaimer: 'Fictional coins and contract terms. An educational story, not financial advice.',
  links: [{ label: 'Explore the illustrated story', href: '/story.html' }],

  style: {
    look: 'Animate the supplied original illustration as a lavish hand-drawn 1980s fantasy adventure cartoon: clean ink contours, painted backgrounds, expressive cel animation, teal and amber palette.',
    rules: 'Genuine character action, not a slideshow or merely a camera zoom. One continuous shot, no cuts, no titles, no lettering, no UI, no subtitles, no dialogue. Subtle synchronized Foley and orchestral tension.',
    safety: 'Family cartoon: no blood, injury, gore or death; failures are comic setbacks.',
  },

  production: {
    provider: 'higgsfield-session',
    model: 'seedance_2_5',
    mode: 'omni_reference',
    duration: 6,
    resolution: '1080p',
    aspect: '16:9',
    audio: true,
    bitrate: 'high',
    continuity: { startFrame: 'location', characterReferences: true, videoReference: false },
    assetBase: 'https://arcade-engine-chi.vercel.app',
  },

  characters: {
    knight: {
      name: 'the knight',
      description: 'the young adult brown-haired knight, teal cloak, worn bronze armor',
      rules: 'Keep the knight visible. Never change his armor or add characters.',
      sheet: '/assets/merchant.webp',
    },
    merchant: {
      name: 'the merchant',
      description: 'the red-haired mustachioed merchant in plum robes with gold trim',
      sheet: '/assets/merchant.webp',
    },
    dragon: {
      name: 'the dragon',
      description: 'the enormous emerald dragon with amber eyes',
      sheet: '/assets/dragon.webp',
    },
  },

  locations: {
    gate: { name: 'the castle gate', description: 'the torchlit stone path before a towering castle gate', keyframe: '/assets/gate.webp' },
    hall: { name: 'the merchant’s hall', description: 'the merchant’s hall with the golden armor on its hanger', keyframe: '/assets/merchant.webp' },
    vault: { name: 'the dragon’s vault', description: 'the gold-strewn vault of the emerald dragon', keyframe: '/assets/dragon.webp' },
  },

  rules: { lives: 3, scoring: { move: 100, scene: 0, ending: 0 }, checkpoints: 'scene' },

  start: 'gate',
  nodes: {
    gate: {
      type: 'scene', clip: 'gate-threat', chapter: 'I · THE APPROACH', location: 'gate', cast: ['knight'],
      shot: { action: 'Castle approach: the knight walks forward on the stone path. At second 2, a heavy loose stone falls from the gate to the RIGHT half of his path, throwing dust. He stops and crouches, watching a second stone start to slide overhead. The LEFT side stays visibly safe.', ends: 'End on suspense before the second stone lands. Do not show an impact on the knight.' },
      beats: [{ at: [0.52, 0.93], cue: 'Stone on the right. Dodge left!', moves: { left: { label: 'Dodge left', to: 'gate-win' } }, decoys: { right: { label: 'Run right' } }, miss: 'gate-fail' }],
      recap: 'Dodged the falling gate stone.',
    },
    'gate-win': {
      type: 'cut', location: 'gate', cast: ['knight'],
      shot: { action: 'Successful dodge: immediately the knight leaps decisively to SCREEN LEFT as a heavy stone crashes onto the path to his RIGHT. His teal cloak whips through a graceful arc. He lands safely, glances back at the rubble with comic relief, then runs toward the illuminated open castle gate.', ends: 'Finish with clear survival and forward progress.' },
      text: { kicker: 'A close call. On to the merchant.', title: 'Nicely played.', body: 'Look before you leap. A moment of attention can save a costly mistake.' },
      next: 'merchant',
    },
    'gate-fail': {
      type: 'death', location: 'gate', cast: ['knight'],
      shot: { action: 'Comedic failure: the knight runs to SCREEN RIGHT into a cloud of dust as a loose gate stone lands just ahead of him. A harmless blast of dust knocks him backward onto his bottom, legs splayed and cloak crumpled. He blinks dazedly and rubs his head.', ends: 'The rock never touches him. Hold the embarrassed defeated pose.' },
      text: { kicker: 'A MINOR SETBACK', title: 'Wrong turn. The gate gets the last word.', body: 'Watch the danger and choose a different move. Your checkpoint is right here.' },
      retry: 'gate',
    },

    merchant: {
      type: 'scene', clip: 'merchant-threat', chapter: 'II · THE FINE PRINT', location: 'hall', cast: ['knight', 'merchant'],
      shot: { action: 'The merchant proudly jiggles the golden armor on its hanger. The long parchment unrolls magically toward the knight’s boots like a creeping snake. The knight notices, raises an eyebrow and reaches toward the parchment.', ends: 'End before he touches it. Gold armor stays on its hanger; the knight keeps his original worn armor. Parchment has no readable writing.' },
      beats: [{ at: [0.48, 0.93], cue: '600 outright. Or 100 + six payments of 120. Inspect first!', moves: { inspect: { key: 'left', label: 'Read the contract', icon: '⌕', to: 'merchant-win' } }, decoys: { sign: { key: 'right', label: 'Grab the offer', icon: '✎' } }, miss: 'merchant-fail' }],
      recap: 'Read the contract before signing.',
    },
    'merchant-win': {
      type: 'cut', location: 'hall', cast: ['knight', 'merchant'],
      shot: { action: 'The knight kneels, carefully examines the long parchment, then decisively rolls it up away from his boots and hands it back to the merchant. He points to his own serviceable breastplate and shakes his head with a knowing smile. The merchant’s broad grin collapses into comic disappointment.', ends: 'Knight turns to leave, cloak swishing, original armor unchanged. Parchment has no readable writing.' },
      text: { kicker: 'Fine print read. Paper trap avoided.', title: 'Nicely played.', body: '100 + (6 × 120) = 820 coins. That is 220 more than the 600-coin price. You kept your old armor and all 1,000 coins.' },
      next: 'dragon',
    },
    'merchant-fail': {
      type: 'death', location: 'hall', cast: ['knight', 'merchant'],
      shot: { action: 'Comedic contract trap: the knight eagerly reaches for the offered armor. The magical parchment curls around his ankles and torso like a loose ribbon, harmlessly tripping him to sit on the step. The golden armor stays in the merchant’s hands.', ends: 'Knight looks bewildered inside the absurd paper cocoon while the merchant looks sheepish. No readable writing.' },
      text: { kicker: 'A MINOR SETBACK', title: 'You got wrapped up in the offer.', body: 'Watch the danger and choose a different move. Your checkpoint is right here.' },
      retry: 'merchant',
    },

    dragon: {
      type: 'scene', clip: 'dragon-threat', chapter: 'III · THE VAULT', location: 'vault', cast: ['knight', 'dragon'],
      shot: { action: 'The dragon inhales, cheeks glowing warm amber, and lowers its snout toward the knight. The knight braces on the left of the frame with his sword held LOW. A few sparks escape the dragon’s nostrils; its impending horizontal flame will pass ABOVE a crouching knight.', ends: 'End at the instant before the breath. No flame impact yet.' },
      beats: [{ at: [0.48, 0.93], cue: 'Watch the dragon. Duck below the flame!', moves: { duck: { key: 'down', label: 'Duck!', keys: [' '], to: 'dragon-win' } }, decoys: { strike: { key: 'up', label: 'Strike!' } }, miss: 'dragon-fail' }],
      recap: 'Ducked the dragon’s flame and kept the reserve.',
    },
    'dragon-win': {
      type: 'cut', location: 'vault', cast: ['knight', 'dragon'],
      shot: { action: 'The knight immediately DUCKS LOW, one knee on the stone, as a narrow playful golden flame passes safely OVER his head. The dragon stops breathing fire, blinks in surprise, then smiles approvingly and gently nudges a small pile of gold toward the knight with one claw.', ends: 'The knight stands, bows and raises a fist in celebration. Clear dodge followed by reward. No armor or face changes.' },
      text: { kicker: 'Flame dodged. The vault is yours.', title: 'You earned your gold.', body: 'You protected your reserve and earned 400 coins. Final purse: 1,400. In this fictional quest, keeping a cushion beat buying the shiny upgrade.' },
      next: 'end',
    },
    'dragon-fail': {
      type: 'death', location: 'vault', cast: ['knight', 'dragon'],
      shot: { action: 'Comedic failure: the knight remains standing and raises his sword as the dragon blows a brief playful puff of golden fire. A smoke cloud briefly obscures him, then clears to reveal the same unharmed knight with soot on his face and a tiny wisp rising from his hair.', ends: 'He lowers his sword and slumps sheepishly. The dragon raises an eyebrow. Original cloak and armor remain intact.' },
      text: { kicker: 'A MINOR SETBACK', title: 'A bold strategy. A lightly toasted result.', body: 'Watch the danger and choose a different move. Your checkpoint is right here.' },
      retry: 'dragon',
    },

    end: {
      type: 'ending',
      text: { kicker: 'THE GOLDEN OFFER · COMPLETE', title: 'Rich in gold. Richer in judgment.', body: 'Three rooms survived. You kept 1,000 coins, avoided the 820-coin contract, and earned 400 more. Final purse: 1,400 coins.' },
    },
  },
};
