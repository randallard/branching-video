# Slice 3b.3: wiring the pages onto the event-log DraftStore

The feature this whole migration was for (see PROGRESS's "Why this started"): the home page's
Import All rejected single-show config files outright, and Studio's "Import config JSON…" accepted
them but silently overwrote a same-titled draft — autosave slugified by title with no collision
check. Both are fixed by construction here, not patched: once every page goes through `DraftStore`'s
showId-based API, there's no title-slug key left to collide on.

Planned in detail first — three Explore passes (Studio, Editor, the core APIs/ADRs) plus a Plan
pass to validate the design — because this touches ~2,000 lines across three pages and a wrong
architecture choice discovered mid-implementation would have been expensive. That plan lived only
in the session that wrote it, not in this repo; this entry is the durable record of what was
designed and what actually happened building it, including two things the plan got wrong.

## Ryan's call: Editor goes draft-first, like Studio

Before writing any code, the real design fork was surfaced: the Editor had no drafts concept at
all — pure file-based (File System Access API / download), used for publishing to `public/live/`.
Asked Ryan directly: file-first with drafts as an additive extra, or draft-first like Studio.

Ryan's own framing decided it: "are any of them saved to browser memory where we could list and
play them from a page?" Today, no — an Editor-built show only becomes browsable if you manually
copy the file into `public/live/`. Draft-first was the only option that actually delivers that
without an extra step, so that's what got built: every edit autosaves into the store, and
Save/Save As is relabeled Export/Export As — still the exact same file-writing mechanism, now an
explicit action for publishing rather than the primary save path.

## Foundational pieces

- **`DraftStore.importLegacyBackup(backup)`** — composes `core/migrate.ts`'s
  `draftsFromLegacyBackup` + `snapshotEventsFromDrafts`, mirroring what `openDraftStore()` already
  does inline for the one-time `localStorage` migration. Old `bvp-backup` files land on
  deterministic `slug:<slug>` show ids — no update-or-add question, unlike a single-show config
  file, because a legacy draft already has an identity (ADR-0011's own wording, re-read carefully
  during planning after an initial assumption that it got the same ask flow — it doesn't).
- **`serialize()`** (`core/serialize.ts`) — `serializeStudio`/`serializeEditor` collapsed into one:
  always writes `choiceDisplaySeconds` (defaulting to 8, confirmed cosmetic-only by checking
  `player.ts:355` already treats a missing value as 8 at read time), always normalizes `endScreen`
  links to exactly one of `url`/`target` (Editor's stricter behaviour). Existing property-test
  coverage lived in `config.test.ts`, not a dedicated file — extended in place rather than
  duplicated into a new `serialize.test.ts`, since the coverage already existed and just needed
  updating for one function instead of two.
- **`src/shell/draft-session.ts`** (new) — `DraftSession` class: `showId`/`nodeKeys` bookkeeping
  plus a serialized persist queue (`persist()` chains onto a `Promise`, so overlapping autosave
  triggers can't race the store's event ordering — parts 1–2 already found exactly this class of
  bug once, from unserialized concurrent saves). Plus `adoptExternalConfig()`: the shared tail of
  "adopt a config from outside" — `matchingTitle()` → a `confirm()` if it matches → `importConfig()`
  → `open()` for the authoritative result. A `confirm()` rather than a new modal, matching the
  codebase's established minimal-chrome style.
- **`src/ui/collisions.ts`** (new) — `notifyCollisions()`: one `confirm()` per ADR-0024 collision,
  title looked up via `store.find(showId)`. Collisions only arise from `importBundle()` (merging
  another device's fine-grained event stream) — a whole-show snapshot import can't produce one —
  so it's called after every `importBundle()`, plus once on every page's boot in case a previous
  session left one unanswered.
- **`core/legacy-backup.ts` retirement** — planned to retire `classifyImport`/`Conflict`/
  `Resolution`/`importedSlug` (the merge-modal machinery) and assumed `buildLegacyBackup` would
  survive as a test fixture builder. A `grep` before deleting anything found `migrate.test.ts`
  builds its fixture as a raw object literal — it never called `buildLegacyBackup` at all. All five
  symbols had zero callers anywhere once `index.ts`'s merge modal went, so all five retired
  together. `parseLegacyBackup`/`DraftEntry`/`LegacyBackup`/`parseDraftEntry`/`parseDraftIndex`
  survive (still needed by `drafts.ts` and `migrate.ts`).
- While touching `drafts.ts` anyway: `saveDraftConfig`, `saveDraftIndex`, `loadDraftConfigText`,
  and `setTransferText` turned out to have zero remaining callers once every page moved onto the
  store — deleted alongside the planned retirement rather than left as dead exports.

## Home page

Import All now takes a `FileList` and classifies each file independently — event bundle
(`isEventBundle`) → legacy backup (`parseLegacyBackup`) → single-show config (`normalizeConfig`) →
invalid — with one combined summary. Export All now produces an event bundle instead of a
`bvp-backup`. The old mine/theirs/both merge modal (`openMergeModal`/`applyMerge`, plus its
`.merge-*` CSS in `index.html`) is gone entirely.

## Studio

`adoptConfig` (serving both "Import config JSON…" and the `#transfer` receive from the Editor)
keeps its existing validation — `masterVideoId` required, legacy backups rejected with a pointer to
Import All — but its tail now goes through `adoptExternalConfig` instead of `enterWorkspace()`'s
unconditional `autoSave()`. That one change is the actual bug fix. `deleteNodeBtn`'s handler had to
change slightly beyond just adding `nodeKeys` bookkeeping: it filtered `config.nodes` by predicate,
which loses index information, so capturing `idx` via `findIndex` first was a required edit, not
just an addition.

The store opens asynchronously (IndexedDB), which introduces a real race the old fully-synchronous
`boot()` never had: the setup screen's buttons are enabled by default in the HTML, so a click
between page load and `openDraftStore()` resolving would hit `draftStore`/`session` before they
exist. Fixed by disabling them synchronously — before boot's first `await` — and re-enabling once
the store is ready. Mirrored identically in the Editor.

## Editor

The bigger change. Draft-first meant auditing every field-mutation handler, not just adding the
storage plumbing — and that audit found a real, pre-existing gap. Many handlers (choice label,
node start/end/showChoicesAt, `choiceDisplaySeconds`, `defaultAside`, end-screen heading/body/
label/url, add/remove/reorder choice, the "has end screen" toggle, and others) only ever called
`runValidation()` or `renderForm()` directly, never `onEdit()`/`structural()`. Under the old
file-based model this was harmless — Save always serialized the *entire* current `config` object
regardless of which handler last touched it, so nothing was ever lost. Under draft-first autosave
it matters much more: a handler that never triggers a persist means that field can be lost if nothing
else on the same node happens to be edited afterward. Went through every mutation site and added
`void persistNow()` where it was missing, rather than leave a landmine in the very feature this
slice exists to make reliable.

A second correctness question came from making `boot()` async: since `loadConfig`/`adoptConfig`
themselves call the render path that persists, and the *very first* config load also runs through
that path, would just opening the Editor spawn a phantom draft on every visit? Split the render
function in two — `renderAll()` (render only) and `structural()`/`onEdit()` (render *and*
`persistNow()`) — so `loadConfig()` (genuinely fresh/untitled loads: `newConfig()`'s blank start,
boot's `config.json` fallback) renders without persisting, while `adoptConfig()`/`openDraft()`
render without persisting too since the config is *already* saved by the time they're called
(`importConfig` or the store's own history did that). Only `newConfig()` explicitly calls
`persistNow()` right after `loadConfig()`, because "New…" is a deliberate create action (like
Studio's `startBtn`) that should show up on the home page immediately, not wait for a first edit.
The smoke test's clearest result confirms this: visiting the Editor with no edit creates nothing;
adding a node does, and it's immediately listed on the home page.

The Editor's known `dirty`-on-load bug (`loadConfig` → `structural()` unconditionally set `dirty`,
arming a spurious `beforeunload` prompt even on a fresh load) is resolved **by elimination**, not
patched. Confirmed by grep that `dirty` gated exactly four things (`beforeunload`, `confirmDiscard`,
and its two call-site guards) and nothing else — once draft-first autosave means an edit is
persisted moments after it's made (matching Studio, which never had this guard), an
"unsaved changes" warning has nothing left to warn about. Deleted the whole apparatus.

A new "My Drafts ▾" menu (`openMyDraftsMenu`/`closeMyDraftsMenu`) mirrors the existing "Configs ▾"
dropdown's exact DOM pattern (`el()` builder, `.dd-head`/`.dd-empty`/`.dd-item` classes, the
`.menu-wrap` outside-click-close wiring) rather than inventing a new one — deliberately kept
separate from "Configs" (published shows from `live/`), matching the existing published-vs-draft
distinction Home and Studio already draw.

## Verification

`pnpm test` 113/113 (14 new: `draft-store.test.ts` +1, `config.test.ts` +2, `draft-session.test.ts`
+7 new file, `ui/collisions.test.ts` +3 new file, `legacy-backup.test.ts` −4 for the retired merge
tests +2 for a leaner `parseLegacyBackup` set). `pnpm lint` and `pnpm build` clean after every step.

No committed e2e harness exists in this repo — every past "smoke test" has been a throwaway,
uncommitted script, and this followed the same practice: a small Node script talking to headless
Chromium's DevTools Protocol directly over its built-in `WebSocket`/`fetch` (no puppeteer/playwright
dependency added), driving real DOM clicks/inputs against a `vite preview`. Covered: all five pages
load with zero console errors; a Studio-created show appears on the home page with no explicit
save; declining Studio's update-or-add prompt on a same-titled import keeps **both** drafts (the
actual bug, actually fixed, actually verified — not just unit-tested); visiting the Editor creates
no phantom draft but a real edit does, and it's immediately browsable; Export All → Import All of
the same bundle is idempotent. One check in the script itself was wrong (a click-intercept trying
to capture the Export download URL fired on `#export-all-btn`'s own `<a href="#">` before its click
handler's `preventDefault()` ran) — diagnosed as a harness bug, not a product one, since the very
next check re-imported that same captured bundle text successfully. Not committed; the script and
its throwaway Chromium profile were deleted after the run, per this project's practice for these
passes.

**Not covered by the smoke test**: the ADR-0024 collision notice's actual UI trigger (constructing
a two-device divergent event bundle and importing it through the real file input) — the underlying
`notifyCollisions()`/`restoreNode()`/`confirmRemoval()` logic is thoroughly unit-tested
(`ui/collisions.test.ts`, plus the pre-existing `draft-store.test.ts` collision fixtures), and the
wiring into Home/Studio/Editor boot was reviewed by hand, but the end-to-end UI path is unverified
in a real browser. Worth Ryan's own pass if a real cross-device merge is exercised soon.
