# Polyester Publishing · the workshop

The public site is a small press. Behind one password is the workshop: a form that turns a story idea into the two
files the engine needs, and the door to the games.

```
/            Polyester Publishing landing page (public)
/login/      one password, from STUDIO_PASSWORD
/studio/     the workshop (behind the password)
/play/       the arcade cabinet, ?game=<slug> (behind the password, or a share link)
/api/*       login, logout, share links, drafting, GitHub hand-off (Vercel functions)
middleware.js  Edge middleware that enforces the session on every protected path
```

## Setup (once, in Vercel → arcade-engine → Settings → Environment Variables)

| variable | required | what it does |
|---|---|---|
| `STUDIO_PASSWORD` | yes | the one password |
| `STUDIO_SECRET` | yes | long random string that signs the session cookie (30-day sessions) |
| `ANTHROPIC_API_KEY` | optional | turns on **Draft with Claude** |
| `GITHUB_TOKEN` + `GITHUB_REPO` | optional | turns on **Send to workshop branch** (`owner/repo`; a fine-grained token with Contents read/write on that repo) |

Rotate `STUDIO_SECRET` to log every browser out at once. Locally, `npm run dev` uses password `polyester` unless
`STUDIO_PASSWORD` is set.

## Bot protection

In the app: constant-time password compare, a 700 ms delay on failure, eight failures per IP per 15 minutes, a honeypot
field that quietly throttles bots, `noindex` on the staff pages, HttpOnly SameSite cookies, and no user enumeration
(there are no users). Share links are signed, scoped to one game, and expire.

In Vercel (Pro plan, two switches, project → Firewall): turn on **Bot Protection** (managed ruleset) and enable
**Attack Challenge Mode** if the site is ever hammered. Optionally add a custom rule that rate-limits `POST /api/login`.

## Using the workshop

1. **Drop in the story.** Title, then paste whatever exists into the big box. Answer the questions you can. Everything saves
   in your browser as you type; projects are listed on the left.
2. **Build.** You get `brief.md` (the answers as a readable brief) and `story.mjs` (a first draft in the engine format:
   one scene per beat with a win film and a comic setback film). It lints in the browser; blanks show as `TODO:`.
3. **Draft with Claude** (when the key is set). Sends the brief to Claude with the format guide and a working example,
   gets back a complete story, lints it server-side, and asks for a correction once if needed. Expect a minute or two.
4. **Hand off.** *Send to workshop branch* commits `stories/<slug>/brief.md`, `story.mjs` and `brief.json` to
   `studio/<slug>` on GitHub. *Copy hand-off prompt* puts a ready-to-paste instruction on the clipboard for a coding
   session. *Download* saves the three files.
5. In a coding session: pull the branch, `npm run story -- <slug> lint`, `plan`, `pack`, generate the films, `ingest`,
   `review`, `npm test`, merge. The game then appears in the workshop's Games list with a Play button and a Share link.

## Share links

*Share link* on a game copies a URL that opens that one game for 30 days without the password. The visitor gets a
game-scoped cookie: they can play that game and nothing else.
