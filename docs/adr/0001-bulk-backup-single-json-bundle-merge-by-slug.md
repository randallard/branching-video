# ADR-0001: Bulk backup as a single JSON bundle, merge-by-slug on import
- Status: Superseded by ADR-0002 (import's overwrite-on-collision behavior only; the single-JSON-bundle format below is unchanged)
- Date: 2026-07-08
- Deciders: Ryan

## Context
Studio persists every draft entirely in `localStorage`: an index at `bvp:index` (array of
`{slug, title, modified}`) plus one JSON config per draft at `bvp:config:<slug>`. The only
existing export path was per-draft — Studio's "Export JSON" button and Editor's Save/Save-as
each serialize a single currently-open config. There was no way to get *all* local drafts out
of a browser at once, so moving to a new browser or machine meant re-creating each draft by
hand or exporting them one at a time.

Asked directly: "is there a way to pull all branching video data from my browser storage, or
do we just have download per video for now?" — answer at the time was no, only per-video.

## Decision
Add "Export All" / "Import All" to `index.html` (the home/drafts list), built on the same
`bvp:index` + `bvp:config:<slug>` keys the rest of the app already uses:

- **Export All** reads `bvp:index` and every corresponding `bvp:config:<slug>`, and downloads
  one file: `{ type: 'bvp-backup', version: 1, exportedAt, index, configs }`.
- **Import All** parses that bundle and merges it into the current browser's `bvp:index` by
  slug — an incoming draft with the same slug as one already present **overwrites** it;
  anything else is added alongside what's already there. No per-conflict prompt, no rename-on-
  collision.

## Alternatives considered
- **Move to IndexedDB** — rejected as out of scope for the ask; current per-project JSON
  configs are small, and `localStorage` already has an index + per-slug keys that work fine
  for this.
- **Per-conflict prompt on import** (keep-mine / keep-theirs / keep-both per slug) — rejected
  for now. The expected use is a single user backing up or moving drafts between browsers, not
  merging two independently-edited sets of drafts under the same slugs.
- **Zip of individual per-video JSON files**, matching the existing per-video export format —
  rejected; the app is intentionally zero-build-step vanilla HTML/JS, and a single JSON object
  needs no extra dependency (e.g. JSZip) to produce or parse.

## Consequences
- Moving all local drafts between browsers/machines is now one file download + one file
  upload, instead of re-creating or exporting drafts individually.
- Import silently overwrites same-slug drafts — fine for backup/restore/move, but there is no
  undo and no warning before an overwrite. Using it to merge two machines' independent edits
  under the same slug will silently drop one side's changes.
- The bundle is plain uncompressed JSON. Fine at today's per-project config sizes; would need
  revisiting (compression, or splitting per-slug) if configs grow large enough that one
  all-drafts bundle becomes unwieldy.
