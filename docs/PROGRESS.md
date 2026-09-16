# Progress & Status

_Last updated: 2026-09-15_

## Status / next

**Status:** Mid-migration onto `cr-ci-cd-rust-typescript-template`
([ADR-0003](adr/0003-retrofit-cr-ci-cd-template-onto-existing-repo.md)). **Slices 1 and 2 are on
`main` and live** (2026-09-14): https://randallard.github.io/branching-video/ is now deployed by
CI from the Vite build (ADR-0006 cutover done — `DEPLOY_PAGES=true`, Pages source = GitHub
Actions). First CI run on `main` (`3a51695`, run 34924103244): docs hygiene, TS fast gates, TS
supply chain, SBOM, OSV scan and deploy all green; Rust jobs skipped as designed. The 16-check
headless smoke test passes against the live URL. Drafts are still in `localStorage`.
**2026-09-15:** the deploy instructions in `README.md` and `create.html` were corrected to match
(they still described branch-root Pages). Uncommitted, waiting on Ryan: `create.html` is a live
page and pushing redeploys, so the live site carries the old copy until then.

**Slice 1 of 4 is committed** on `adopt-template` as `981add8` (not pushed): conventions,
CI, licence, ADRs 0003–0019 (0008, 0009, 0011 accepted by Ryan; ADR-0002 superseded).

**Slice 2 of 4 is committed but not yet browser-verified** (Ryan chose to push and test later) — the Vite +
strict-TypeScript build with every page ported behaviour-for-behaviour, still on `localStorage`.
What's verified (2026-09-14): `pnpm lint` (zero warnings), `pnpm test` (25 tests incl. fast-check
properties), `pnpm build`, `pnpm audit` (clean), `pnpm audit signatures` (285 verified), the
licence allowlist, OSV-Scanner container on a clean export (no issues), `pnpm validate`, and a
16-check headless-Chromium smoke test of the built site and the dev server (home page shows +
legacy drafts, Studio resume and ukulele import, Editor load/validation/Configs menu, Player
title/menu/missing-config, Import All merge modal + keep-both) — all passing.
**Not verified — needs Ryan in a real browser:** actual YouTube playback, segment transitions,
choice countdown, asides/back-to-branch, Studio marking against a playing video, the Editor's
mobile drawer and Chromium Save As. See [journal 2026-09-14-2](journal/2026-09-14-2-slice-2-typescript-port.md).

**Also in slice 2, by Ryan's decisions (2026-09-14):** ADR-0020 (relative base) and ADR-0021
(generated manifest) accepted; **ADR-0022** — a node with no choices (and no aside `returnTo` or
`endScreen`) now plays on into the next node in order, so the ukulele and Cardistry shows play
straight through; README carries an "early development — breaking changes at any time" warning
(no one has been handed this yet; switch to non-breaking development if someone asks to use it).

**Next:**
1. Ryan: `pnpm install`, restart the dev server as `pnpm dev` (still `0.0.0.0:8080`), click
   through the unverified list above — now including a no-choice show playing through (load the
   ukulele file in Studio → Play ▶). Also give `create.html` a read on the live site: its
   deploy step was rewritten 2026-09-15 and hasn't been looked at in a browser.
2. Start slice 3 (event-log core, IndexedDB, `localStorage` migration).

**Why this started:** Ryan wanted to load previously exported single-show configs (e.g.
`most-useful-music-theory-for-ukulele 3.json`). Today: home-page **Import All** rejects them
("does not look like a Branching Video backup" — it only takes `bvp-backup` bundles); Studio's
**Import config JSON…** accepts them but autosaves by title slug, silently overwriting a
same-titled draft. **Workaround until slice 4 (from reading the code, not tried in a browser):** Studio → Import config JSON… should work if no
draft with the same title exists (or rename/export the existing one first).

## Architecture

Target state, decided 2026-09-14. Links rather than restatement:

- Rigor tier: provable-lite, strict TS, pure core + fast-check — [ADR-0004](adr/0004-provable-lite-strict-typescript-and-property-tests.md)
- Build: Vite multi-page, page URLs unchanged, runtime-fetched JSON in `public/` — [ADR-0005](adr/0005-vite-multi-page-build-replaces-no-build-html.md), superseded by [0020](adr/0020-vite-multi-page-build-with-relative-base.md) (relative base); manifest generated — [0021](adr/0021-generate-show-manifest-at-build.md)
- Routing: no-choice nodes continue to the next node — [ADR-0022](adr/0022-no-choice-nodes-continue-to-next-node.md)
- Hosting: Pages from the CI artifact (`DEPLOY_PAGES`) — [ADR-0006](adr/0006-pages-deploy-from-ci-build-artifact.md)
- Storage: IndexedDB append-only event log, event-bundle backups — [ADR-0007](adr/0007-indexeddb-append-only-event-log-storage.md); event model [0008](adr/0008-edit-level-events-per-field-last-writer-wins.md), identity [0009](adr/0009-show-identity-by-generated-id-not-slug.md), legacy import [0011](adr/0011-legacy-drafts-and-backups-import-as-snapshot-events.md)
- Show file format unchanged (player, `live/`, and cycle-in depend on it) — [ADR-0010](adr/0010-config-json-stays-the-publish-and-interchange-format.md)
- Supply chain — ADRs [0012](adr/0012-block-install-time-scripts.md)–[0018](adr/0018-pin-actions-to-commit-shas.md); licence [0019](adr/0019-dual-mit-apache-license.md)

Reference implementation for the event log, IndexedDB store and bundle format:
[cycle-in](https://github.com/randallard/cycle-in) (`src/core/events.ts`, `reduce.ts`,
`bundle.ts`, `src/shell/storage.ts`).

## Provability

Property tests (`fast-check`) on `src/core/`, run by `pnpm test`:

- `slugify` always yields `[a-z0-9]+(-[a-z0-9]+)*` and is idempotent; `uniqueId` / `importedSlug`
  never return a taken id.
- `extractVideoId` recovers any 11-character id from every supported URL shape.
- `normalizeConfig` and `validate` never throw on arbitrary JSON; any well-formed linear chain of
  1–30 nodes validates with zero errors and warnings; every dangling choice target is reported.
- Both serializers are stable (`serialize ∘ normalize ∘ serialize = serialize`), emit no `_` or
  undefined keys, and round-trip the real ukulele export exactly.
- Legacy backup import classification partitions every importable entry into exactly one of
  fresh / identical / conflict, and a machine importing its own backup gets no fresh or conflicts.
- Manifest build/parse round-trips.
- Segment-end routing: `continue` only ever targets the immediately following node and never
  fires from the last node; choices show exactly when a node has them; the validator's
  continue rule agrees with the player's.

Not yet: the event log reducer and import idempotence — slice 3 (ADR-0004).

## Worklist

1. **Slice 1 — conventions, CI, ADRs.** Done, committed on the branch.
2. **Slice 2 — build + typed pages.** Committed; browser pass still owed. Layout: `src/core` (config model, text helpers, validate,
   serializers, manifest, legacy backup), `src/shell` (youtube, drafts, files, shows), `src/ui/dom.ts`,
   `src/pages/*.ts`; `tools/validate-config.ts` runs under Node type stripping.
3. **Slice 3 — event-log core.** Events (ADR-0008), show ids (0009), reducer, event bundle,
   snapshot import with content-hash ids (0011), IndexedDB store, one-time `localStorage`
   migration; unify the Studio and
   Editor serializers (they differ today, preserved deliberately in slice 2).
4. **Slice 4 — the feature.** Single-show config import through Import All (multi-file) and
   Studio, per ADR-0011. Then retest with the ukulele file.
5. **Cutover** — done 2026-09-14 (see Status); its documentation debt cleared 2026-09-15.
   `README.md`'s "Deploy" section and `create.html` step 2 now say Pages source = GitHub Actions
   plus a `DEPLOY_PAGES=true` repository variable, and the "no build step" copy in both files was
   reworded — see [journal 2026-09-15](journal/2026-09-15-deploy-instructions-catch-up.md).

Found in slice 2, not yet scheduled:
- **Editor marks a freshly loaded file as unsaved** (`loadConfig` → `structural()` sets `dirty`),
  so leaving the Editor prompts even with no edits. Pre-existing; kept in the port, commented.
- No favicon (404 on every page).

Carried over, not yet scheduled (from `notes.txt`):
- Single-choice default nodes should auto-advance with no choice UI or 8s countdown (scoped
  as ~3 lines in `onSegmentEnded`). Every node in the ukulele show has no choices, so this
  decides how that show plays. Do it in slice 3's routing core rather than in the old JS.
- Chapter menu split into "Main chapters" / "Deep dives" if cluttered on mobile.
- Mermaid chapter maps (maybe).
- Studio doesn't catch overlapping node times (the ukulele file has `major-scale` start 399.2
  before the previous node's end 399.4) — a candidate validator warning.

## Open questions

- Same-field edits on two devices resolve to the later clock under ADR-0008; the losing value
  stays in the log but there's no history view to recover it. Build one, or accept?
- Retired with ADR-0002 (superseded by 0008), kept for the record: the `-imported` copy
  accumulation and `JSON.stringify` conflict detection.

---

_History accretes below, oldest first. See [`journal/`](journal/README.md) for the narrative
and [`reviews/`](reviews/README.md) for stance reviews._

- **2026-07-08** — Investigated storage (all `localStorage`, no bulk export existed); added
  Export All / Import All to `index.html` ([e97075d](https://github.com/randallard/branching-video/commit/e97075d));
  recorded as [ADR-0001](adr/0001-bulk-backup-single-json-bundle-merge-by-slug.md); stood up
  `docs/adr/` + `docs/journal/`.
- **2026-07-08 (2)** — Replaced the blind overwrite-by-slug import with per-conflict resolution
  (keep mine / keep backup / keep both); [ADR-0002](adr/0002-import-conflict-resolution-per-draft-choice.md).
  Committed as [3bb7fd8](https://github.com/randallard/branching-video/commit/3bb7fd8) (this
  file said "not yet committed" until 2026-09-14). The two-profile browser test of a divergent
  same-slug merge is not recorded as done.
- **2026-07-10** — "fix studio load" ([a058284](https://github.com/randallard/branching-video/commit/a058284)):
  Editor gained "Open in Studio" (transfer via `bvp:transfer`), Studio consumes it. Not
  journaled at the time.
- **2026-09-14** — Audited against the template; Ryan chose full migration, IndexedDB event log,
  Actions deploy, branch-in-slices. Slice 1 written. See
  [journal 2026-09-14-1](journal/2026-09-14-1-adopt-the-template.md).
- **2026-09-14 (2)** — Slice 1 committed (`981add8`). Slice 2 written: Vite + strict TS port of all
  pages, core property tests, supply-chain config and gates verified locally, headless smoke test.
  The pnpm trust gate refused `@types/node@22` (a provenance downgrade in `undici-types@6.21.0`),
  and `vitest@4.1.8` carried a moderate advisory (moved to 4.1.11). See
  [journal 2026-09-14-2](journal/2026-09-14-2-slice-2-typescript-port.md).
- **2026-09-14 (3)** — Ryan accepted ADR-0020/0021, decided no-choice nodes continue (ADR-0022,
  implemented in `src/core/routing.ts`), asked for the breaking-changes README warning, and chose
  to commit and push slice 2 before the browser pass.
- **2026-09-14 (4)** — Cutover: `main` fast-forwarded to `adopt-template` (`3a51695`), Ryan set
  `DEPLOY_PAGES` and the Pages source (the settings change was blocked for the agent as a
  production deploy), pushed to GitHub with `gr push --remote origin`, CI + deploy green, live
  smoke test 16/16.
