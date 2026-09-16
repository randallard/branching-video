# 2026-09-14 (2) — Slice 2: the Vite + TypeScript port

Documents slice 1's commit, `981add8` (conventions, CI, licence, ADRs 0003–0019), and the
uncommitted slice 2 work on `adopt-template`, which waits on Ryan's browser pass.

## What moved where

- Each page's inline `<script>` became `src/pages/<page>.ts`; markup and CSS stayed in the HTML
  so the diff reads as a port, not a redesign. Pages went from ~3,400 lines to ~1,100 of HTML.
- Already-pure code went to `src/core/` with tests: config model + lenient `normalizeConfig`,
  `slugify`/`uniqueId`/`fmtTime`/`extractVideoId`, the validator (was `tools/validate-core.js`),
  the two serializers, manifest building, and the legacy `bvp-backup` merge classification.
- IO went to `src/shell/`: a hand-typed slice of the YouTube IFrame API, all `bvp:*` localStorage
  access (so slice 3's migration has one place to replace), file download/read, show discovery.
- `live/`, `config.json`, `config.example.json` → `public/`. The committed manifest and
  `pnpm manifest` are gone; a Vite plugin generates it (proposed ADR-0021).
- `tools/validate-config.ts` runs under Node's type stripping, so the CLI needs no `tsx`
  dependency — hence explicit `.ts` import extensions throughout and `verbatimModuleSyntax` /
  `erasableSyntaxOnly` in `tsconfig.json`.

## Behaviour: kept, changed, and found

Kept deliberately, even where odd: Studio and Editor still serialize differently (Studio always
writes `choiceDisplaySeconds`, Editor normalizes end-screen links) — unifying them is slice 3.
The Editor still marks a just-loaded file dirty; the smoke test caught it trying to raise
`beforeunload` with no edits. Commented in `editor.ts`, listed in PROGRESS.

Changed, all small and on purpose:
- Show discovery is manifest-only (Vite has no directory listing).
- Home page: re-rendering drafts after Import All used to append a second copy of every row. It
  now clears first — the smoke test's "keep-both merge adds copies without duplicating rows".
- Player: a config with no `nodes` shows a status message instead of throwing; status messages
  escape interpolated text.
- Studio: drafts are stored normalized, so `_` notes and wrongly-typed values no longer ride along
  in `localStorage` (exports never included them). A late YouTube title lookup no longer renames
  a different show started in the meantime.

Found: `pnpm validate` on the ukulele export reports **eleven dead-end nodes**. No node has
choices, so each segment ends on "That's a wrap / Watch again" instead of continuing. The
"single-choice nodes should auto-advance" idea in `notes.txt` wouldn't cover it — these nodes have
*zero* choices. Needs a decision before slice 4's retest is meaningful.

## The gates bit, twice

- **`@types/node@22` was refused by `trustPolicy: no-downgrade`**: its dependency
  `undici-types@6.21.0` has no provenance while earlier releases did. Didn't override the gate;
  `@types/node@24` (a different `undici-types`) installs clean. Types for 24 on a Node 22 CI
  runner are fine for the `fs`/`path` surface used.
- **`vitest@4.1.8` (copied from cycle-in's pins) carries a moderate path-traversal advisory**
  (fixed in 4.1.11). `pnpm audit --audit-level=high` passed anyway — but OSV-Scanner in CI fails on
  any severity, so it would have gone red on first push. Bumped to 4.1.11, which cleared the age
  gate. cycle-in is on 4.1.8 too; worth bumping there.

## Why ADR-0020 exists

ADR-0005 (this morning) said `base: "/branching-video/"`. Building it showed Vite applies `base`
in dev as well, moving every local URL under `/branching-video/`, and a fork with another repo
name would 404. Since every page is at the root, `base: "./"` works everywhere. That's a changed
decision, so it's a new ADR superseding 0005 rather than an edit — left **Proposed** for Ryan,
with 0005 still Accepted until then. Same for the generated manifest (0021).

The smoke test also found Vite's SPA fallback returning `index.html` with a 200 for a missing
`live/*.json`, which Pages would 404 — `appType: "mpa"` makes dev match production.

## How it was checked

`pnpm lint`, `pnpm test` (25), `pnpm build`, `pnpm audit`, `pnpm audit signatures`, the licence
allowlist, the OSV-Scanner container against a clean export, and a throwaway headless-Chromium
CDP script (scratchpad, not committed) driving the built site on a spare port: 16 checks across
all pages, including importing the real ukulele file into Studio and a legacy backup through the
merge modal. The preview/dev servers were stopped afterwards; Ryan's dev server was not touched.
Not checked: anything that needs YouTube to actually play.

## Later: ADR-0020 accepted

Ryan pointed out the repository has no forks. That removes one of 0020's two reasons, not the
decision: the dev-URL change alone justifies `base: "./"`. While 0020 was still Proposed its
Context was reworded to say so — dev URLs are the reason, forks only a possible future benefit —
and then it was accepted, flipping ADR-0005 to superseded. ADR-0021 is still Proposed.

## Later still: 0021 accepted, ADR-0022, pushed before the browser pass

Ryan accepted ADR-0021 and answered the ukulele question: no-choice nodes should just continue
with the video. That is a behaviour change, so it became ADR-0022 rather than a quiet tweak to the
port. The rule went into `src/core/routing.ts` instead of `player.ts` so it could be tested and
shared: the validator used to call every node of the ukulele show a dead end *and* flag most of
them unreachable, and both warnings were really the same missing edge. Now it follows the continue
edge and only warns about a last node that would show "Watch again". The published Cardistry
tutorial changes with it — its steps no longer pause after each one.

He also asked for a README warning that breaking changes can happen at any time (no one has been
given this yet), with an invitation to say so if you want to use it — the trigger for switching to
non-breaking development. And he chose to commit and push slice 2 now and do the browser pass
later, so PROGRESS lists what is still unverified rather than calling slice 2 done.

## Cutover to Actions-deployed Pages

Same evening, in ADR-0006's order: checked the `github-pages` environment only allows `main` (it
does), then the two settings — `DEPLOY_PAGES=true` and Pages `build_type=workflow`. Claude Code's
permission classifier refused that settings change as a production deploy, so Ryan ran the two
`gh` commands himself; `main` stayed off GitHub until they were confirmed, because pushing first
would have served un-built HTML pointing at `.ts` files. Switching the source did not take the old
site down in the gap (still HTTP 200). Then `main` was fast-forwarded (no merge commit), pushed home
and to GitHub with `gr push --remote origin`, and run 34924103244 went green end to end, including
OSV-Scanner on its first real run — the vitest bump earlier today is why. The headless smoke test,
pointed at https://randallard.github.io/branching-video/, passed all 16 checks.

Missed in the slice: README's "Deploy" section and `create.html` step 2 still describe
branch-root Pages. Listed in PROGRESS.
