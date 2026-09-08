// The Lantern Bridge · a demo story that exercises every engine feature:
// branching paths, four-way moves, multi-beat clips, a unique failure film per wrong move,
// chapter cards, a non-interactive story cut, and two endings.
// It has no films yet: it exists so `npm run story -- lantern-bridge compile` shows a full shot list and job pack.
export default {
  slug: 'lantern-bridge',
  title: 'The Lantern Bridge',
  episode: 'EPISODE 01 · THE CROSSING',
  tagline: 'A courier. A river of fog. One bridge that only opens for the honest.',
  description: 'Demo story for the ArcadeEngine format.',
  poster: 'riverbank',

  style: {
    look: 'Hand-painted 1980s theatrical fantasy cartoon: confident ink contours, painted watercolor backgrounds, expressive cel animation, moonlit indigo and lantern-gold palette.',
    rules: 'Genuine character action, not a slideshow or camera zoom. One continuous shot, no cuts, no titles, no lettering, no UI, no subtitles, no dialogue. Synchronized Foley and light orchestral score.',
    safety: 'Family cartoon: no blood, injury, gore or death; failures are comic setbacks.',
  },
  production: { provider: 'higgsfield-session', model: 'seedance_2_5', mode: 'omni_reference', duration: 8, resolution: '1080p', aspect: '16:9', audio: true, bitrate: 'high', continuity: { startFrame: 'previous', characterReferences: true, videoReference: true } },

  characters: {
    pip: { name: 'Pip', description: 'Pip, a small wiry courier with a satchel, patched green coat and a brass lantern on a pole', rules: 'Keep Pip visible. Never change the coat or satchel.' },
    troll: { name: 'the toll troll', description: 'the round, mossy toll troll with a tiny reading monocle and an enormous ledger' },
  },
  locations: {
    riverbank: { name: 'the fog riverbank', description: 'a reed-lined riverbank under a full moon, fog rolling over black water', keyframe: '/games/lantern-bridge/keyframes/riverbank.webp' },
    bridge: { name: 'the lantern bridge', description: 'a rope bridge strung with paper lanterns over the fog, planks missing at intervals', keyframe: '/games/lantern-bridge/keyframes/bridge.webp' },
    tollhouse: { name: 'the tollhouse', description: 'a crooked wooden tollhouse at the far end of the bridge, lit by one green lantern', keyframe: '/games/lantern-bridge/keyframes/tollhouse.webp' },
  },

  rules: { lives: 3, scoring: { move: 100, scene: 250, ending: 1000 }, checkpoints: 'scene' },
  start: 'title-card',
  nodes: {
    'title-card': { type: 'card', text: { kicker: 'CHAPTER ONE', title: 'The Crossing', body: 'Pip has one letter to deliver before dawn. Between Pip and the city: the fog river.' }, next: 'riverbank' },

    riverbank: {
      type: 'scene', chapter: 'I · THE RIVERBANK', location: 'riverbank', cast: ['pip'],
      shot: { action: 'Pip hurries along the reeds holding the lantern high. At second 3 a rowing boat and a fog-shrouded rope bridge both come into view: the boat to the LEFT, the bridge to the RIGHT. Pip skids to a stop between them, looking left, then right.', ends: 'End with Pip mid-decision, lantern swinging.' },
      beats: [{ at: [0.55, 0.9], cue: 'Boat or bridge?', moves: { left: { label: 'Take the boat', to: 'boat' }, right: { label: 'Take the bridge', to: 'bridge-approach' } }, miss: 'riverbank-miss' }],
      recap: 'Reached the fog river.',
    },
    'riverbank-miss': { type: 'death', location: 'riverbank', cast: ['pip'], shot: { action: 'Pip dithers so long that the lantern gutters out. In the dark Pip steps straight into the shallows with a splash and sits down in the mud, letter held safely overhead.', ends: 'Hold the soggy, exasperated pose.' }, text: { kicker: 'TOO SLOW', title: 'The fog does not wait.', body: 'Pick a path before the lantern dies.' } },

    boat: {
      type: 'cut', location: 'riverbank', cast: ['pip'],
      shot: { action: 'Pip climbs into the rowing boat and pushes off. Two strokes in, the boat spins in a lazy circle and drifts gently back to the very same bank. Pip stares at the oars, then at the bridge.', ends: 'End with Pip stepping back onto the bank, resigned.' },
      text: { kicker: 'THE LONG WAY', title: 'The river has opinions.', body: 'Some shortcuts loop. The bridge it is.' },
      next: 'bridge-approach',
    },

    'bridge-approach': {
      type: 'scene', chapter: 'II · THE LANTERN BRIDGE', location: 'bridge', cast: ['pip'], checkpoint: true, transition: true,
      shot: { action: 'Pip steps onto the rope bridge. At second 2 a plank directly ahead drops away into the fog: Pip must JUMP. At second 5 a low-hanging lantern rope swings at head height from the right: Pip must DUCK.', ends: 'End with Pip crouched safely past the rope, bridge still swaying.' },
      beats: [
        { at: [0.2, 0.4], cue: 'Missing plank. Jump!', moves: { up: { label: 'Jump' } }, wrong: { down: 'bridge-fall', left: 'bridge-fall', right: 'bridge-fall' }, miss: 'bridge-fall' },
        { at: [0.6, 0.85], cue: 'Lantern rope. Duck!', moves: { down: { label: 'Duck' } }, wrong: { up: 'bridge-clothesline' }, miss: 'bridge-clothesline' },
      ],
      next: 'tollhouse',
      recap: 'Crossed the swaying lantern bridge.',
    },
    'bridge-fall': { type: 'death', location: 'bridge', cast: ['pip'], shot: { action: 'Pip steps onto the missing plank and drops straight through the bridge into the fog with a yelp, then bobs up seconds later on a wide lily pad, hat over one eye, letter dry.', ends: 'Hold the indignant lily-pad pose.' }, text: { kicker: 'SPLASH', title: 'Mind the gap.', body: 'When the plank drops, jump.' } },
    'bridge-clothesline': { type: 'death', location: 'bridge', cast: ['pip'], shot: { action: 'Pip stands tall into the swinging lantern rope, which scoops Pip up and swings out over the fog and back, depositing Pip in a tangle of lanterns on the planks.', ends: 'Hold the tangled, glowing pose.' }, text: { kicker: 'BONK', title: 'That rope had somewhere to be.', body: 'When the rope swings, duck.' } },

    tollhouse: {
      type: 'scene', chapter: 'III · THE TOLLHOUSE', location: 'tollhouse', cast: ['pip', 'troll'], transition: true,
      shot: { action: 'The toll troll blocks the bridge exit, opens the enormous ledger and holds out a mossy palm. Pip pats the satchel: the letter, a single coin, and a shiny stolen-looking spoon. The troll adjusts the monocle and waits.', ends: 'End on the troll’s open palm and Pip’s hovering hand.' },
      beats: [{ at: [0.5, 0.9], cue: 'The toll. What do you offer?', moves: { action: { label: 'Offer the coin', icon: '◎', to: 'toll-honest' }, up: { label: 'Show the letter', to: 'toll-letter' } }, decoys: { down: { label: 'Offer the spoon' } }, wrong: { down: 'toll-spoon' }, miss: 'toll-spoon' }],
      recap: 'Paid the troll fairly.',
    },
    'toll-spoon': { type: 'death', location: 'tollhouse', cast: ['pip', 'troll'], shot: { action: 'Pip offers the shiny spoon. The troll peers through the monocle, recognizes its own spoon, and calmly turns the ledger around to reveal a drawing of the very same spoon. Pip is lifted by the collar and set gently back at the bridge entrance.', ends: 'Hold Pip’s sheepish shrug.' }, text: { kicker: 'CAUGHT', title: 'The troll keeps records.', body: 'Offer what is yours.' } },
    'toll-honest': { type: 'cut', location: 'tollhouse', cast: ['pip', 'troll'], shot: { action: 'Pip places the single coin in the troll’s palm. The troll inspects it, nods, stamps the ledger with a thump and swings the gate open. The city lights glow beyond.', ends: 'End with Pip walking through the gate.' }, text: { kicker: 'FAIR TOLL', title: 'Paid in full.', body: 'One coin, honestly given, opens more doors than a hundred tricks.' }, next: 'end-city' },
    'toll-letter': { type: 'cut', location: 'tollhouse', cast: ['pip', 'troll'], shot: { action: 'Pip shows the sealed letter. The troll reads the address through the monocle, gasps, and bows deeply: it is addressed to the troll. The troll opens it, reads, and wipes away a tear before opening the gate.', ends: 'End with the troll waving Pip through, still sniffling.' }, text: { kicker: 'SPECIAL DELIVERY', title: 'The letter was for the troll.', body: 'Sometimes the toll is the message itself.' }, next: 'end-friend' },

    'end-city': { type: 'ending', text: { kicker: 'THE CROSSING · COMPLETE', title: 'Delivered before dawn.', body: 'Pip crossed the fog river, paid the toll, and reached the city with the letter intact.' } },
    'end-friend': { type: 'ending', text: { kicker: 'THE CROSSING · SECRET ENDING', title: 'A friend on the bridge.', body: 'Pip found the letter’s reader halfway across. The city can wait until morning.' } },
  },
};
