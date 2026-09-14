# Progress & Status

_Last updated: 2026-09-14_

## Status / next

**Status:** Mid-migration onto `cr-ci-cd-rust-typescript-template`
([ADR-0003](adr/0003-retrofit-cr-ci-cd-template-onto-existing-repo.md)), on branch
**`adopt-template`**. `main` is unchanged: it is still the no-build static site (five HTML pages,
inline JS, drafts in `localStorage`) that GitHub Pages serves from the branch root at
https://randallard.github.io/branching-video/.

**Slice 1 of 4 is committed** on `adopt-template` (not pushed): conventions skill +
stance-review skill, `CLAUDE.md`, template CI workflows, CODEOWNERS, `scripts/docs-hygiene.py`,
dual licence, the `template` remote, ADRs 0003–0019 (all Accepted — Ryan accepted 0008, 0009
and 0011 on 2026-09-14, so ADR-0002 is now superseded), the journal filename fix.

**Now:** slice 2 — build + typed pages, no behaviour change (see Worklist).

**Why this started:** Ryan wanted to load previously exported single-show configs (e.g.
`most-useful-music-theory-for-ukulele 3.json`). Today: home-page **Import All** rejects them
("does not look like a Branching Video backup" — it only takes `bvp-backup` bundles); Studio's
**Import config JSON…** accepts them but autosaves by title slug, silently overwriting a
same-titled draft. **Workaround until slice 4 (from reading the code, not tried in a browser):** Studio → Import config JSON… should work if no
draft with the same title exists (or rename/export the existing one first).

## Architecture

Target state, decided 2026-09-14. Links rather than restatement:

- Rigor tier: provable-lite, strict TS, pure core + fast-check — [ADR-0004](adr/0004-provable-lite-strict-typescript-and-property-tests.md)
- Build: Vite multi-page, page URLs unchanged, runtime-fetched JSON in `public/` — [ADR-0005](adr/0005-vite-multi-page-build-replaces-no-build-html.md)
- Hosting: Pages from the CI artifact (`DEPLOY_PAGES`) — [ADR-0006](adr/0006-pages-deploy-from-ci-build-artifact.md)
- Storage: IndexedDB append-only event log, event-bundle backups — [ADR-0007](adr/0007-indexeddb-append-only-event-log-storage.md); event model [0008](adr/0008-edit-level-events-per-field-last-writer-wins.md), identity [0009](adr/0009-show-identity-by-generated-id-not-slug.md), legacy import [0011](adr/0011-legacy-drafts-and-backups-import-as-snapshot-events.md)
- Show file format unchanged (player, `live/`, and cycle-in depend on it) — [ADR-0010](adr/0010-config-json-stays-the-publish-and-interchange-format.md)
- Supply chain — ADRs [0012](adr/0012-block-install-time-scripts.md)–[0018](adr/0018-pin-actions-to-commit-shas.md); licence [0019](adr/0019-dual-mit-apache-license.md)

Reference implementation for the event log, IndexedDB store and bundle format:
[cycle-in](https://github.com/randallard/cycle-in) (`src/core/events.ts`, `reduce.ts`,
`bundle.ts`, `src/shell/storage.ts`).

## Provability

Nothing is verified yet — there is no TypeScript and no test. Planned properties (ADR-0004):
reducer is permutation- and duplication-invariant; importing a file twice is a no-op; import
never removes an existing show; export→import round-trips a show; routing from any node of a
valid config reaches a defined node or end screen.

## Worklist

1. **Slice 1 — conventions, CI, ADRs.** Done, committed on the branch.
2. **Slice 2 — build + typed pages, no behaviour change.** `package.json` (exact versions, pnpm
   11, `license`, `lint`/`test`/`build` scripts, drop `serve`), `.npmrc`, `pnpm-workspace.yaml`,
   `renovate.json`, `tsconfig.json`, `eslint.config.js`, `vite.config.ts` (multi-page,
   `base: "/branching-video/"`). Move `live/`, `config.json`, `config.example.json` to
   `public/`; switch show discovery to `live/manifest.json` only (Vite dev has no directory
   listing) and regenerate it in `pnpm build`. Port each page's inline script to `src/`
   behaviour-for-behaviour; still `localStorage`. Verify every page by running it (Ryan
   controls the dev server — `pnpm dev` replaces `serve`), plus `pnpm lint/test/build`, the
   supply-chain commands, and the OSV container.
3. **Slice 3 — pure core.** Config parse/serialize/validate (replacing
   `tools/validate-core.js`), routing, events, reducer, bundle, import; IndexedDB store; the
   one-time `localStorage` migration. fast-check properties above.
4. **Slice 4 — the feature.** Single-show config import through Import All (multi-file) and
   Studio, per ADR-0011. Then retest with the ukulele file.
5. **Cutover** (ADR-0006, ordered, on the live site): merge to `main`, set `DEPLOY_PAGES=true`,
   switch Pages source to GitHub Actions, check a `player.html?config=…#node` link. Rewrite
   `README.md` and `create.html` deploy instructions in the same change.

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
- Should `pnpm manifest` run inside `pnpm build`, or stay a manual step?
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
