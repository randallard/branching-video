# Progress & Status

_Last updated: 2026-09-18_

## Status / next

**Status:** Mid-migration onto `cr-ci-cd-rust-typescript-template`
([ADR-0003](adr/0003-retrofit-cr-ci-cd-template-onto-existing-repo.md)). **Slices 1 and 2 are on
`main` and live** (2026-09-14): https://randallard.github.io/branching-video/ is now deployed by
CI from the Vite build (ADR-0006 cutover done — `DEPLOY_PAGES=true`, Pages source = GitHub
Actions). First CI run on `main` (`3a51695`, run 34924103244): docs hygiene, TS fast gates, TS
supply chain, SBOM, OSV scan and deploy all green; Rust jobs skipped as designed. The 16-check
headless smoke test passes against the live URL. Drafts are still in `localStorage`.
**2026-09-15:** the deploy instructions in `README.md` and `create.html` were corrected to match
(they still described branch-root Pages), committed as `f0d76df` and pushed to GitHub. CI run
35040523912 green and Pages redeployed; the live `create.html` was re-fetched and confirmed to
serve the new step. The live site is now consistent with how it is actually built.

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
**Partial browser pass done 2026-09-15:** the ukulele show plays through all eleven no-choice
nodes as ADR-0022 intended. It surfaced that the show stops 6:24 short of the master video (last
node ends 806.5, video is 1190) — Ryan kept the wrap behaviour and had the authoring rule
documented instead; ADR-0022 stands unamended and no code changed. See
[journal 2026-09-15-2](journal/2026-09-15-2-browser-pass-last-node-wrap.md).
**Still not verified — needs Ryan in a real browser:** YouTube playback quirks, segment
transitions, choice countdown, asides/back-to-branch, Studio marking against a playing video, the
Editor's mobile drawer and Chromium Save As. See [journal 2026-09-14-2](journal/2026-09-14-2-slice-2-typescript-port.md).

**Also in slice 2, by Ryan's decisions (2026-09-14):** ADR-0020 (relative base) and ADR-0021
(generated manifest) accepted; **ADR-0022** — a node with no choices (and no aside `returnTo` or
`endScreen`) now plays on into the next node in order, so the ukulele and Cardistry shows play
straight through; README carries an "early development — breaking changes at any time" warning
(no one has been handed this yet; switch to non-breaking development if someone asks to use it).

**2026-09-17 — supply-chain audit.** All eight supply-chain ADRs (0012–0018) verified implemented
and green against live config and a real CI run; `pnpm audit` clean, 285/285 signatures verified,
licence allowlist exit 0, all 22 action `uses:` SHA-pinned. Three fixes committed (`40272dd`): the SBOM now
names its subject (`branching-video@0.1.0`, was `{"type":"file","name":"."}`), a floor of 50
components fails the job if a cataloger stops matching, and **`osv-scan` now gates the deploy** — a
red scan used to publish to Pages anyway. The SBOM's empty `licenses` fields turn out to be correct
and are now commented as such: cataloging `node_modules` instead doubles the component count to 548
and picks up stale store trees. The real gap is that nothing in 0012–0018 covers the one script that
reaches a viewer — [ADR-0026](adr/0026-content-security-policy-on-the-player-pages.md) proposes a CSP
(accepted and shipped 2026-09-18, see below). See [journal 2026-09-17](journal/2026-09-17-supply-chain-audit.md).

**2026-09-18 — branch protection set; Renovate still unconfirmed.** `main` now requires a pull
request before merging (0 required approvals — Ryan is the only reviewer, so requiring one would
deadlock every PR) plus the checks that actually run on a PR: `detect languages`, `docs hygiene`,
`ts fast gates`, `ts supply chain`, `SBOM`, `OSV scan / osv-scan` (`deploy to Pages` excluded — it
never runs on a PR). `enforce_admins: false`, so Ryan can still push directly to `main` if needed;
this binds Renovate and any future collaborator, not him. **This changes the workflow**: every
prior commit on this repo was a direct push to `main`, and that path is now closed unless he uses
the admin bypass. Force-push and branch deletion are blocked outright. Renovate's installation
was still unconfirmed via API at the time (the endpoints that would say so directly aren't
reachable with this token), but four days post-adoption there was no Dependency Dashboard issue
(which `config:recommended` turns on unconditionally), no PRs, no bot activity in repo events, and
no webhooks — leaning not installed. Ryan checked <https://github.com/settings/installations> the
same day and confirmed it was missing, then **installed it the same day** — the onboarding flow
defaulted to a paid tier, which he caught and switched to free before confirming. No Dependency
Dashboard issue or PR yet as of this update; that's expected on a first run and is worth checking
again in a day or two. See
[journal 2026-09-18](journal/2026-09-18-branch-protection-and-renovate-check.md). **Update the same
day: Renovate is confirmed working** — it opened PR #3 (`actions/checkout` digest bump), which Ryan
merged manually (automerge is off by Renovate's own default config). That closes the "check in a
day or two" item above.

**2026-09-18 (2) — ADR-0026 accepted and shipped.** Ryan accepted the CSP proposal and asked for it
done directly rather than deciding-then-handing-off. Exactly the small change estimated: one
`<meta http-equiv="Content-Security-Policy">` tag, identical content, on all five Vite entry pages.
`pnpm build` clean; verified with a throwaway headless-Chromium pass (not committed — see the
smoke-test note in [journal 2026-09-14 (2)](journal/2026-09-14-2-slice-2-typescript-port.md))
against a `vite preview` on a spare port, including `player.html` actually loading a real show and
exercising the YouTube IFrame API against `www.youtube.com` — zero CSP violations. ADR-0026 is now
Accepted. See [journal 2026-09-18 (2)](journal/2026-09-18-2-csp-accepted-and-shipped.md).

**2026-09-18 (3) — slice 3b.3: the page wiring, done.** The home page, Studio and the Editor are
all wired onto the event-log `DraftStore` — this is **the feature the whole migration was for**
(see "Why this started" below, now resolved). Foundational pieces first: `DraftStore.importLegacyBackup`
(old `bvp-backup` files → snapshot events, ADR-0011), a unified `serialize()` replacing
`serializeStudio`/`serializeEditor` (always writes `choiceDisplaySeconds`, always normalizes
`endScreen` links), a shared `DraftSession` (showId/nodeKeys bookkeeping + a serialized persist
queue, since parts 1–2 already found a real same-millisecond ordering bug from unserialized
concurrent saves), and a shared `notifyCollisions` (ADR-0024, one `confirm()` per collision).
`core/legacy-backup.ts`'s ADR-0002 merge machinery (`classifyImport`/`Conflict`/`Resolution`/
`importedSlug`/`buildLegacyBackup`) retired outright — a `grep` before deleting found
**`buildLegacyBackup` had zero callers anywhere**, not just the merge-modal path, correcting an
assumption from planning.

Home page: Import All now takes a `FileList` and classifies each file independently — event
bundle, legacy backup, or single-show config (ADR-0011's per-file update-or-add question) — with
one combined summary; Export All now produces an event bundle instead of a `bvp-backup`. The old
mine/theirs/both merge modal is gone entirely. Studio: `adoptConfig` (import + `#transfer` receive)
goes through the same update-or-add path instead of autosaving over a same-titled draft by
title-slug — **the exact bug this migration exists to fix**. Editor: chosen "draft-first, like
Studio" — every edit autosaves into the store via the same `DraftSession`, so an Editor-built show
appears on the home page and is playable with no explicit save, matching what Ryan asked for; a new
"My Drafts ▾" menu opens one by showId; Save/Save As is relabeled Export/Export As — still the same
File System Access/download mechanism, now an explicit file-publishing action rather than the
primary save path. The Editor's known `dirty`-on-load bug (PROGRESS's earlier "found in slice 2"
list) is resolved **by elimination, not patched**: draft-first autosave makes an "unsaved changes"
warning meaningless, so `dirty`/`beforeunload`/`confirmDiscard` were deleted rather than fixed.
Auditing every field handler while wiring persistence in found several (choice label, node
start/end, `choiceDisplaySeconds`, end-screen fields, others) that never triggered *any* save path
before — harmless under the old file-based model (Save always wrote the current in-memory state
regardless), a real gap under draft-first autosave. Fixed all of them.

`pnpm test` 113/113, `pnpm lint` and `pnpm build` clean throughout. Verified with a throwaway CDP
smoke-test script (Node, no added dependency — matches this project's established practice) against
a `vite preview`: all five pages load with zero console errors; a Studio-created show appears on
the home page with no explicit save; declining Studio's update-or-add prompt on a same-titled
import keeps **both** drafts instead of silently overwriting one; visiting the Editor creates no
phantom draft, but a real edit does, and that edit is immediately browsable from the home page;
Export All → Import All of the same bundle is idempotent. See
[journal 2026-09-18 (3)](journal/2026-09-18-3-slice-3b3-page-wiring.md).

**Next:**
1. Ryan: `pnpm install`, restart the dev server as `pnpm dev` (still `0.0.0.0:8080`), click
   through the unverified list above — now including a no-choice show playing through (load the
   ukulele file in Studio → Play ▶). Also give `create.html` a read on the live site: its
   deploy step was rewritten 2026-09-15 and, while the corrected copy is confirmed live, no one
   has yet read it as a person following the instructions. **New in this slice, worth Ryan's own
   browser pass too:** Studio's Import config JSON… update-or-add prompt, the Editor's My Drafts
   menu and Export relabeling, and the home page's three-way Import All — including importing the
   **real** ukulele single-show config file (`most-useful-music-theory-for-ukulele 3.json`, the
   file that started this whole migration), since the CDP smoke test only used synthetic fixtures.
2. ~~Slice 3b part 3~~ done 2026-09-18 — see above.
3. ~~Ryan: decide ADR-0026 (CSP).~~ Done 2026-09-18 — accepted and shipped, see above.
4. ~~Branch protection~~ done 2026-09-18. ~~Renovate installation~~ confirmed installed and
   working 2026-09-18 (PR #3 merged). Note the new PR-required workflow on `main` going forward —
   a direct `git push` to `main` will be rejected unless the admin bypass is used.
5. ~~Slice 4's ADR-0024 UI~~ delivered in 3b.3. What's left of slice 4: **ADR-0023** (per-field
   value history) — not started.

**Why this started:** Ryan wanted to load previously exported single-show configs (e.g.
`most-useful-music-theory-for-ukulele 3.json`). Before slice 3b.3: home-page **Import All** rejected
them outright, and Studio's **Import config JSON…** accepted them but autosaved by title slug,
silently overwriting a same-titled draft. **Fixed 2026-09-18** (see slice 3b.3 above): Import All
now accepts single-show configs directly, asking once per file if the title matches an existing
show; Studio's import goes through the same path instead of overwriting silently.

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

- `slugify` always yields `[a-z0-9]+(-[a-z0-9]+)*` and is idempotent; `uniqueId` never returns a
  taken id.
- `extractVideoId` recovers any 11-character id from every supported URL shape.
- `normalizeConfig` and `validate` never throw on arbitrary JSON; any well-formed linear chain of
  1–30 nodes validates with zero errors and warnings; every dangling choice target is reported.
- `serialize` is stable (`serialize ∘ normalize ∘ serialize = serialize`), emits no `_` or
  undefined keys, round-trips the real ukulele export exactly, always writes
  `choiceDisplaySeconds`, and normalizes every `endScreen` link to exactly one of `url`/`target`
  (unified from the two diverging pre-3b.3 serializers — see [journal
  2026-09-18 (3)](journal/2026-09-18-3-slice-3b3-page-wiring.md)).
- Manifest build/parse round-trips.
- Segment-end routing: `continue` only ever targets the immediately following node and never
  fires from the last node; choices show exactly when a node has them; the validator's
  continue rule agrees with the player's.

Added in slice 3a (`order.test.ts`, `canonical.test.ts`, `reduce.test.ts`, `bundle.test.ts`,
`migrate.test.ts`, `shell/event-store.test.ts`):

- **`reduce` is a function of the event set** — `reduce(events) === reduce(reversed)`, unchanged by
  duplicates and by re-importing a subset. This is what makes a two-device merge a plain union.
- Two devices editing *different* fields both survive; the same field resolves to the later write;
  an exact timestamp tie breaks by event id, deterministically.
- Migration is idempotent: the snapshot id is a content hash excluding the clock, so the same
  content imported twice is a no-op, and an old `bvp-backup` lands on the same shows as the drafts
  it came from.
- Bundles round-trip and serialize deterministically; union is commutative across two devices.
- Order keys stay strictly ordered and distinct under 500 repeated insertions at the same spot.
- A config round-trips exactly through a snapshot; snapshot node keys are deterministic.
- Removal beats a later field set; a re-add lifts the removal and edits apply again; a snapshot
  clears the removal record; one show's removals don't touch another's.

Added in slice 3b parts 1–2 (`diff.test.ts`, `shell/draft-store.test.ts`, more in
`reduce.test.ts`):

- Any config round-trips through a diff, and so does an edit applied on top of an existing show;
  an unchanged save emits nothing, which is what makes it safe on every autosave.
- A rename emits one field-set and keeps the node key; a reorder emits exactly one event.
- Two devices editing different fields of the same node keep both — end to end, through export and
  import, not just at the reducer.
- Re-importing the same bundle or the same config file adds nothing.
- An ADR-0024 collision is reported with the node as it stood, and both answers settle it.

Not yet: nothing outstanding in the core. 3b.3's page wiring added `draft-session.test.ts` and
`ui/collisions.test.ts` (thin coverage over already-tested store methods) and
`core/serialize.test.ts`-equivalent coverage inside `config.test.ts` for the unified serializer;
the page-level wiring itself is exercised by the throwaway CDP smoke test, not unit tests.

## Worklist

1. **Slice 1 — conventions, CI, ADRs.** Done, committed on the branch.
2. **Slice 2 — build + typed pages.** Committed and live; browser pass still owed. Layout: `src/core` (config model, text helpers, validate,
   serializers, manifest, legacy backup), `src/shell` (youtube, drafts, files, shows), `src/ui/dom.ts`,
   `src/pages/*.ts`; `tools/validate-config.ts` runs under Node type stripping.
3. **Slice 3 — event-log core.** Split in two.
   - **3a — the pure core and the store. Done, committed (`4b7f39c`), pushed.** `core/order.ts`
     (fractional order keys), `core/canonical.ts` (canonical JSON + content hash),
     `core/events.ts` (envelope + ADR-0008 kinds), `core/reduce.ts` (fold the event set),
     `core/bundle.ts` (event bundle), `core/migrate.ts` (legacy drafts/backups/config files as
     snapshots), `shell/event-store.ts` (IndexedDB, idempotent by event id, in-memory fallback).
     Additive: nothing imports it, built page hashes unchanged, app behaviour identical.
     Tests 30 → 71. See [journal 2026-09-15-3](journal/2026-09-15-3-slice-3a-event-log-core.md).
   - **3b — the wiring. Split in three; all three parts done.**
     `editor.ts` is 984 lines, Studio 654, the home page 294, so rewiring all of it in one commit
     would not have been reviewable.
     - **3b.1 — collision detection + diff emitter. Done.** `reduce` returns the ADR-0024
       collisions it noticed; `core/diff.ts` emits one event per changed field, against a
       `WorkingShow` (config + aligned key list) so a rename stays a rename. Order assignment
       keeps the longest ascending run and rewrites only the rest.
     - **3b.2 — the draft store. Done.** `shell/draft-store.ts`: list/open/save/create/remove,
       export/import, collisions, and the first-load migration. The seam the pages move onto.
       Found and fixed two ordering bugs — see the journal.
     - **3b.3 — the page wiring. Done 2026-09-18.** Home page (event-bundle Export/Import All +
       ADR-0011 update-or-add for single-show config files — the feature this migration was for);
       Studio (resume list, autosave, "Import config JSON…" through the same path); Editor
       (draft-first autosave through the store, a new My Drafts menu, Export/Export As replacing
       Save/Save As); the ADR-0024 notice with its two answers; the Studio and Editor serializers
       unified into one `serialize()`. `setResume` moved from slug to `showId` (ADR-0009);
       `classifyImport`/`Conflict`/`Resolution`/`importedSlug`/`buildLegacyBackup` retired
       entirely — all five, not just the merge-modal path (a planning assumption corrected during
       implementation: `buildLegacyBackup` turned out to have zero remaining callers anywhere). See
       [journal 2026-09-18 (3)](journal/2026-09-18-3-slice-3b3-page-wiring.md).
   - **Both decisions 3a had to make are now ADRs (2026-09-15), so 3b starts with them settled.**
     - [ADR-0025](adr/0025-snapshot-node-keys-derived-from-node-id.md) — snapshot node keys come
       from the node's `id`, falling back to a content hash (not position) for duplicate or blank
       ids. Already implemented and property-tested. 3b's diff emitter must produce keys that
       agree with this.
     - [ADR-0024](adr/0024-node-removal-collisions-ask-rather-than-resolve.md) — delete-versus-edit
       collisions are reported rather than silently resolved. **This adds work to 3b:** `reduce`
       must return the collisions it noticed alongside the shows, and import must be wired as
       something the UI observes rather than a silent background fold.
4. **Slice 4 — the feature.** ~~Single-show config import through Import All (multi-file) and
   Studio, per ADR-0011.~~ Delivered ahead of schedule as part of 3b.3 (2026-09-18) rather than a
   separate slice — see Status/Worklist item 3 above. Retest with the real ukulele file is still
   owed (Ryan; the CDP smoke test used synthetic fixtures, not it). ~~Delete-versus-edit
   notification (ADR-0024) — the UI half.~~ Also delivered in 3b.3: `ui/collisions.ts`'s
   `notifyCollisions`, wired into all three pages. What's left of this slice:
   - **Per-field value history** ([ADR-0023](adr/0023-per-field-value-history.md)) — derived from
     the events, so no schema work; the cost is an affordance on every edited field across Studio
     and the Editor. Not started.
5. **Cutover** — done 2026-09-14 (see Status); its documentation debt cleared and shipped
   2026-09-15 (`f0d76df`).
   `README.md`'s "Deploy" section and `create.html` step 2 now say Pages source = GitHub Actions
   plus a `DEPLOY_PAGES=true` repository variable, and the "no build step" copy in both files was
   reworded — see [journal 2026-09-15](journal/2026-09-15-deploy-instructions-catch-up.md).

6. **Supply-chain audit** — done 2026-09-17. ADRs 0012–0018 all implemented; SBOM subject naming,
   the non-empty assertion and the `osv-scan` deploy gate fixed in `ci.yml` (`40272dd`). All four
   items it left open are now closed (2026-09-18): ADR-0026 (CSP) accepted and shipped; branch
   protection set on `main`; Renovate confirmed installed and working (PR #3 merged). See Status
   above.
   ADR-0012's body names a pnpm field that doesn't exist (`allowBuilds`; the real one is
   `onlyBuiltDependencies`) — the ADR is immutable, so the correction lives in the journal.

Found in slice 2, not yet scheduled:
- **No validator warning for a show that stops short of its video.** Raised 2026-09-15 and not
  chosen; it would need the source video's duration, which the validator has no way to get
  without a network call. The README and `create.html` carry the rule instead.
- ~~Editor marks a freshly loaded file as unsaved~~ — resolved 2026-09-18 by elimination, not a
  patch: slice 3b.3's draft-first autosave means an edit is persisted moments after it's made
  (matching Studio, which never had this guard), so `dirty`/`beforeunload`/`confirmDiscard` were
  deleted rather than fixed.
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

_None outstanding._ The three that slice 3a raised were all settled 2026-09-15; see below.

## Answered 2026-09-15, now ADRs

- Same-field edits lose a value silently → **build a per-field "what else has this been" history**,
  [ADR-0023](adr/0023-per-field-value-history.md). Derived from the events, no new event kind;
  recovering an old value is an ordinary edit. Can't start before 3b.
- A node deleted on one device and edited on another → **tell the person at the time and let them
  decide**, [ADR-0024](adr/0024-node-removal-collisions-ask-rather-than-resolve.md). The reducer
  still resolves deterministically so nothing blocks; the collision is reported and the answer is
  appended as an ordinary event.
- Where snapshot node keys come from → **the node's own `id`, with a content-hash fallback for
  duplicate or blank ids**, [ADR-0025](adr/0025-snapshot-node-keys-derived-from-node-id.md).
  Implemented in `snapshotNodeKeys`: the positional fallback is gone, because reordering a config
  used to repoint keys at the wrong nodes silently.

## Closed, kept for the record

- The `-imported` copy accumulation and `JSON.stringify` conflict detection were
  [ADR-0002](adr/0002-import-conflict-resolution-per-draft-choice.md)'s problems. ADR-0002 is
  superseded by [0008](adr/0008-edit-level-events-per-field-last-writer-wins.md), so neither
  applies any more — kept here so a reader who remembers them knows where they went, not as
  anything outstanding.

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
- **2026-09-15** — Deploy-instruction catch-up: `README.md` §3 and `create.html` step 2 rewritten
  for the Actions build, three falsified "no build step" claims reworded, committed and pushed
  (`f0d76df`), CI green, corrected copy confirmed live. See
  [journal 2026-09-15](journal/2026-09-15-deploy-instructions-catch-up.md).
- **2026-09-15 (2)** — Partial browser pass: ADR-0022 play-through confirmed on the ukulele show.
  The last node wraps at 806.5s of an 1190s video; Ryan chose to keep the behaviour and document
  the authoring rule (finish with a node that reaches the end of the video, or give it an
  `endScreen`). README + `create.html` updated, no code change. See
  [journal 2026-09-15-2](journal/2026-09-15-2-browser-pass-last-node-wrap.md).
- **2026-09-15 (3)** — Slice 3a: the event-log core and store, additive and green (`4b7f39c`),
  tests 30 → 71. Slice 3b (the page wiring) is next. See
  [journal 2026-09-15-3](journal/2026-09-15-3-slice-3a-event-log-core.md).
- **2026-09-15 (4)** — Ryan answered both outstanding design questions:
  [ADR-0023](adr/0023-per-field-value-history.md) (per-field "what else has this been" history) and
  [ADR-0024](adr/0024-node-removal-collisions-ask-rather-than-resolve.md) (delete-versus-edit
  collisions are reported, not silently resolved). 0024 widens slice 3b: `reduce` must report
  collisions and import must be observable. Snapshot node keys remain the one open question.
- **2026-09-15 (5)** — Deliberated the last open question and settled it as
  [ADR-0025](adr/0025-snapshot-node-keys-derived-from-node-id.md): snapshot node keys derive from
  the node's `id`, with a content-hash fallback replacing the positional one. The deciding
  constraint was ADR-0011's event id, which covers the config but not the keys — so carrying keys
  in the event would give two devices the same event id with different payloads. `snapshotNodeKeys`
  hardened accordingly; the two new tests fail against the old positional rule. No open questions
  outstanding.
- **2026-09-15 (6)** — Slice 3b parts 1–2: collision detection, the diff emitter and the draft
  store, all green and still additive (page hashes unchanged). Tests 71 → 103. Two ordering bugs
  found by the tests: `toConfig` aliased the reduced state so in-place edits diffed to nothing, and
  event order was decided by a random tiebreak because a whole save landed in one millisecond. See
  [journal 2026-09-15-4](journal/2026-09-15-4-slice-3b-core-and-store.md). Part 3, the page
  wiring, is next.
- **2026-09-17** — Audited the supply-chain posture at Ryan's request. All eight ADRs hold. The SBOM
  is complete (285 npm components matching the lockfile exactly) but didn't name its subject and
  nothing asserted it was non-empty; both fixed. Its missing licence data is correct — cataloging
  `node_modules` yields 548 components for 285 packages and surfaces stale `vitest@4.1.8` trees — and
  the reasoning is now a comment in `ci.yml`. `osv-scan` added to the deploy's `needs`. Found that
  nothing in 0012–0018 covers `https://www.youtube.com/iframe_api`, the only third-party code that
  reaches a viewer; [ADR-0026](adr/0026-content-security-policy-on-the-player-pages.md) proposes a
  CSP and is Proposed, not Accepted. See
  [journal 2026-09-17](journal/2026-09-17-supply-chain-audit.md).
- **2026-09-18** — Branch protection set on `main` via `gh api` at Ryan's request: PR required to
  merge (0 approvals — Ryan's the only reviewer), the checks that run on a PR required (not
  `deploy to Pages`, which doesn't), `enforce_admins: false` so Ryan can still bypass, force-push
  and deletion blocked. Every prior commit was a direct push, so this closes that path going
  forward unless bypassed. Renovate's installation couldn't be confirmed via API (token isn't
  authorized for either installation endpoint), but circumstantial signals (no Dependency
  Dashboard issue, no PRs, no bot events, no webhooks, four days on) leaned not installed — Ryan
  checked <https://github.com/settings/installations>, confirmed it was missing, and installed it
  the same day (catching an accidental paid-tier default and switching to free before confirming).
  No dashboard issue or PR yet as of install; a follow-up check is on the list. See
  [journal 2026-09-18](journal/2026-09-18-branch-protection-and-renovate-check.md).
- **2026-09-18 (2)** — Confirmed Renovate is alive: it opened PR #3 (`actions/checkout` digest
  bump), Ryan merged it manually. Then he accepted ADR-0026 and asked for it implemented directly:
  the CSP meta tag landed on all five pages, `pnpm build` stayed clean, and a throwaway
  headless-Chromium pass — including an actual `player.html` load exercising the real YouTube
  IFrame API — showed zero CSP violations. ADR-0026 flipped to Accepted. See
  [journal 2026-09-18 (2)](journal/2026-09-18-2-csp-accepted-and-shipped.md).
- **2026-09-18 (3)** — Slice 3b.3, the page wiring, done — the feature the whole migration was
  for. Home page, Studio and the Editor all moved onto the event-log `DraftStore`; Studio's
  silent-overwrite-on-import bug and Import All's rejection of single-show configs are both fixed
  by construction, not patched. Editor became draft-first (Ryan's choice), gaining a My Drafts menu
  and an Export/Export As relabeling of Save/Save As; its `dirty`-on-load bug retired by
  elimination along with `beforeunload`/`confirmDiscard`. `classifyImport`/`Conflict`/`Resolution`/
  `importedSlug`/`buildLegacyBackup` deleted outright — a grep before deleting found
  `buildLegacyBackup` had no callers left at all, correcting a planning assumption. `pnpm test`
  113/113, verified end to end with a throwaway CDP smoke script (Studio→Home autosave, the
  update-or-add prompt actually keeping both drafts, Editor draft-first with no phantom draft on a
  bare page load, idempotent bundle round-trip). See
  [journal 2026-09-18 (3)](journal/2026-09-18-3-slice-3b3-page-wiring.md).
