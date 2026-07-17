# AGENTS.md — American Mahjong PWA

A mobile-first American Mahjong scoring/practice game (NMJL-style hands, Charleston, solo bots, and family multiplayer via Firebase/localStorage). Keep changes conservative and preserve the existing structure.

## Stack (authoritative)

Vanilla static HTML/CSS/ES modules served by Firebase Hosting. No build step,
no bundler, no framework. This is NOT a React/Vite/Next project — do not add
a build system, bundler, or framework unless explicitly asked.

- Firebase services in use: **Hosting + Firestore only.** There are no Cloud
  Functions in this repo — do not add a `functions/` directory or assume one
  exists.
- Firebase project: `mahjong-lincoln` (see `.firebaserc`). Client config
  (`js/firebase.js`) is a public web API key — fine to keep committed; it is
  not a secret. Multiplayer falls back to `localStorage` cross-tab sync when
  Firebase isn't configured/reachable, so both paths must keep working.
- **Root-level layout, not `public/`.** `firebase.json` sets `"hosting": { "public": "." }`
  — Hosting serves the repo root directly. `index.html`, `style.css`, `sw.js`,
  `manifest.json`, and `js/` all live at the top level, not under a `public/`
  subfolder. Don't create one.

## Project shape

- App entry / shell: `index.html` — all screens (lobby, room lobby, game
  board, Charleston overlay, card viewer, how-to-play guide, menu, round
  result) are `<section>`/`<div class="overlay">` blocks in one file, toggled
  by class (`active`/`hidden`), not routed pages.
- Styles: `style.css` (single stylesheet, ~1,700 lines; mobile-first).
- Client logic, `js/`:
  - `js/engine.js` — pure game rules/state: wall generation, tile suits,
    Charleston validation, meld/claim building, Mahjong hand matching against
    `HANDS_CARD`, hand-difficulty analysis, custom-pattern parsing. No DOM
    access — this is what `check.mjs` unit-tests.
  - `js/app.js` — orchestration: wires DOM events to `engine.js`, drives
    local bot turns, Charleston flow, claim windows, and remote room sync.
  - `js/ui.js` — DOM rendering: the `elements` registry
    (`document.getElementById` lookups) and all render functions
    (`renderRack`, `renderDiscardRiver`, card viewer, co-pilot suggestions,
    etc.). `js/app.js` reads/writes DOM only through `elements.*` — a name
    must exist in the `ui.js` registry before `app.js` can reference it (this
    is one of the `check.mjs` DOM-contract checks).
  - `js/bot.js` — solo-play AI opponent decisions (discard/claim choices).
  - `js/firebase.js` — Firestore multiplayer room sync + localStorage
    tab-sync fallback; also encodes/decodes array↔map shapes for Firestore
    (Firestore can't store sparse arrays the way `gameState.hands`/
    `exposures` need).
  - `js/practice-card.js` — practice-card/custom-card helper data & rendering
    support used alongside `HANDS_CARD` in `engine.js`.
- PWA: `manifest.json` (icons, standalone display) + `sw.js` (network-first
  service worker; cache-busts via `CACHE_NAME` and the `?v=N` query strings
  on script/style tags in `index.html` — bump both together when you change
  a cached file, or phones will keep serving the stale one).
- Firebase config: `firebase.json` (Hosting rewrites/headers, Firestore rules
  path), `.firebaserc` (project alias), `firestore.rules` (room schema +
  read/write validation for the `rooms/{roomId}` collection — short, readable
  room codes are intentional for family link-sharing), `firestore.indexes.json`.
- Tests: `check.mjs` — a single Node script (no test framework, no
  `package.json`). Run directly with `node check.mjs`. Covers engine unit
  tests (wall composition, hand matching, Charleston/claim/joker-exchange
  logic, difficulty scoring) AND static DOM-contract checks (unique HTML
  ids, every `ui.js` registry entry resolves to a real id, every
  `elements.*` reference used in `app.js` is registered, a handful of
  specific CSS/markup invariants like the co-pilot color key and mobile
  discard-river containment).

## The loop (run before declaring done)

There is no `package.json`, no `npm install`, and no build step.

```sh
node check.mjs
```

This must print `📊 Test Summary: Passed N/N` with no `❌ FAIL` lines and
exit 0. If you touch `index.html` ids, the `elements` registry in `js/ui.js`,
or anything `check.mjs` asserts on by literal string (e.g. specific CSS
selectors, specific copy like the "Soap" dragon label), expect it to catch
you — read the failing assertion message, it names the exact contract.

There is no browser/DOM test runner and no visual regression check. After
any UI change, state in your report which screens/flows you manually traced
through the code for (e.g. "Charleston pass validation for a 3-tile pass,
lobby→room-lobby→game-board transition, round-result exit path") — don't
claim a UI change works without saying what you checked.

If you add a `package.json` for any reason, wire `node check.mjs` up as
`npm test` but do not turn this into an `npm install`-then-build workflow.

## Guardrails

- **Human owns the push.** Never run `git push` and never deploy. A push to
  `main` auto-triggers the production Firebase Hosting deploy, so a push IS a
  production release. Approval of the *work* ("looks good", "ship it") is NOT
  permission to push. Push only on an explicit, literal instruction ("push to
  main", "deploy this"). When done, commit locally, report the commit SHA(s),
  and stop.
- **Surgical changes only.** Keep edits focused on the request. No unrelated
  refactoring, reformatting, or renaming across `js/engine.js`/`js/ui.js`/
  `js/app.js`.
- **Mobile first.** Verify mobile layout after any UI change — this is a
  phone-table-top game; the felt board, tile rack, and overlays all have
  mobile-specific sizing in `style.css` (see the discard-river containment
  rule `check.mjs` guards).
- **No `innerHTML` for user-entered data.** Player names (join-room form) and
  any other user-typed text must render via `textContent` (see `js/app.js`
  line ~867, `item.textContent = ...`). The existing `innerHTML` uses in
  `js/ui.js` are static, internally-generated markup (tile faces, card
  viewer rows, co-pilot cards) — keep that boundary; don't start
  interpolating user input into any of those templates.
- **`js/engine.js` stays DOM-free.** It's the pure-logic layer `check.mjs`
  unit-tests directly via `import`. Don't reach into `document`/`window`
  from it, and don't move rendering logic into it.
- **Keep the `elements` registry and cache-bust versions in sync.** Adding a
  DOM id to `index.html` that `js/ui.js`/`js/app.js` needs requires adding it
  to the `elements` registry in `js/ui.js` too, or `check.mjs` fails. Changing
  a cached file's contents means bumping its `?v=N` in `index.html` and the
  matching entry (plus `CACHE_NAME`) in `sw.js`.
- **Firestore rules must match `js/firebase.js`'s room shape.** `gameState`
  is an allow-listed key set in `firestore.rules` — adding a new field to the
  room's `gameState` in code requires adding it to `validRoom()`'s
  `hasOnly([...])` list too, or writes will be rejected in production (won't
  show up locally against the localStorage fallback).
- **Firebase client config is public, not secret** — fine to keep in
  `js/firebase.js`. Don't add API secrets, service-account keys, or anything
  requiring server-side auth; this app has no backend beyond Hosting +
  Firestore.

## Maintaining this file

Update this AGENTS.md in the SAME commit whenever you change the project's
shape, stack, build/test commands, or a guardrail. A stale AGENTS.md is worse
than none — it makes the agents confidently wrong.
