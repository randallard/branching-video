# 2026-09-14 (1) — Adopting the cr-ci-cd template

Documents slice 1 on branch `adopt-template`, landing in the commit alongside this entry; the
follow-up entry will name it.

## How it started

Ryan wanted to load `most-useful-music-theory-for-ukulele 3.json` — a single-show config
downloaded from Studio/Editor. Looking into it:

- Home-page **Import All** only accepts `bvp-backup` bundles, so it rejects the file.
- Studio's **Import config JSON…** accepts it, but `adoptConfig` → `enterWorkspace` →
  `autoSave` → `saveToLS` keys by `slugify(title)` with no existence check. A same-titled draft
  is overwritten without a word — the loss ADR-0002 was written to prevent, via the one import
  path that doesn't go through ADR-0002's code.

Before choosing a fix, Ryan asked whether the repo met the template's standards. It didn't,
beyond having ADRs and a journal: inline untyped JS in five pages, no tests, no CI, no licence,
no supply-chain posture, and `docs-hygiene` failing on `journal/2026-07-08.md`.

## The choices

Offered: conventions only / conventions plus a first TS slice / full migration. Ryan chose
**full migration**. Then three deliberations:

- **Storage.** I recommended keeping `localStorage` behind a module (no data migration). Ryan
  chose the template default instead — **IndexedDB + event log like cycle-in**. That turns the
  loader fix from "add a third copy of the merge rules" into "every import emits events; union
  is the merge", which is the better end state.
- **Fork story.** Pages from the CI artifact, forkers set `DEPLOY_PAGES` (not committed `dist/`).
- **Delivery.** Branch, four reviewable slices, nothing on `main`/live until verified.

## Things worth remembering

- **cycle-in reads this project's `config.json`** (its ADR-0004, `src/core/bvimport.ts`). So the
  event log is internal only and the show file format is frozen as the interchange format
  (ADR-0010). Easy to miss when "moving to an event log" sounds like "changing the format".
- **Event granularity is the real decision**, not "event log yes/no". Whole-config snapshots
  would be the smallest Studio change but reintroduce silent loss on two-device merges, just
  without ADR-0002's screen. Proposed edit-level, per-field last-writer events (ADR-0008) and
  left it Proposed for Ryan — along with generated show ids (0009) and the legacy/single-file
  import rules (0011). Single-show files have no identity, so one prompt survives: update the
  matching show or add a new one.
- **Content-hash event ids make imports idempotent**: the same file or legacy draft imported on
  any device, any number of times, produces the same event id and dedupes.
- **Discovery depends on `serve`'s directory listing** (`index.html`, `editor.html` fetch
  `live/` as HTML first). Vite dev won't list directories — slice 2 has to go manifest-only.
- **Cutover ordering matters on the live site**: merging to `main` before switching Pages to
  the Actions source would serve un-built source to anyone following a YouTube-card link.

## Housekeeping done

- Renamed `2026-07-08.md` → `2026-07-08-1-bulk-export-import.md` (filename convention only;
  content untouched). Links updated in `PROGRESS.md` and the journal index.
- ADR-0001 was partially superseded ("overwrite behaviour only; format unchanged") — a sign it
  held two decisions. Rather than edit it, its Status line now names both superseders
  (0002 for overwrite, 0007 for format).
- `PROGRESS.md` said the 07-08 merge work was "not yet committed"; it was (`3bb7fd8`), and
  `a058284` (07-10, "fix studio load") was never journaled. Corrected in PROGRESS; this entry
  is the record.
- The `new-project` skill was not copied — this session was its interview.
- Supply-chain config files (`.npmrc`, `pnpm-workspace.yaml`, `renovate.json`) are deferred to
  slice 2, where dependencies are actually installed and the gates can be verified rather than
  just written.

## Later the same day

Ryan accepted ADRs 0008, 0009 and 0011 as proposed. Their Status lines flipped to Accepted, the
"Proposed" markers came out of their Decision sections (never frozen, since they weren't yet
accepted), and ADR-0002's Status now reads superseded by 0008.
