# 2026-07-08

Documents [e97075d](https://github.com/randallard/branching-video/commit/e97075d).

## The question

Asked whether there was a way to pull *all* branching-video data out of browser storage, or
whether per-video download was still the only option.

## What was there already

All persistence is `localStorage`, no IndexedDB, no dedicated storage module — each HTML file
inlines its own reads/writes:

- `bvp:index` — array of `{slug, title, modified}`, the list of local drafts (`index.html`,
  `studio.html`).
- `bvp:config:<slug>` — one full JSON config per draft.
- `bvp:transfer` / `bvp:resume` — short-lived handoff keys between Studio/Editor/Player.

Export only ever existed per-project: Studio's "Export JSON" button and Editor's Save/Save-as
each serialize the single currently-open config. Nothing walked `bvp:index` to bundle every
draft together, and there was no import counterpart either.

## What was added

"Export All" and "Import All" buttons above the Local Drafts list in `index.html`:

- **Export All** walks `bvp:index`, pulls every `bvp:config:<slug>`, and downloads one
  `branching-video-backup-YYYY-MM-DD.json` containing `{type: 'bvp-backup', version: 1,
  exportedAt, index, configs}`.
- **Import All** validates the bundle's `type`, then merges its `index` entries and
  `bvp:config:<slug>` values into whatever is already in this browser — same-slug drafts are
  overwritten, everything else is added. Re-renders the local drafts list afterward.

Decision (overwrite-by-slug, single JSON, no IndexedDB migration) recorded as
[ADR-0001](../adr/0001-bulk-backup-single-json-bundle-merge-by-slug.md).

## Also today

Stood up `docs/adr/` and `docs/journal/` for this project (previously undocumented), following
the same convention as the git-redundancy and home-fleet efforts, and linked branching-video
from `~/Development/work/README.md`'s effort table.

## Next

- No warning is shown before Import All overwrites a same-slug draft — worth a confirmation
  dialog if this ever gets used to merge two machines' independent edits rather than a clean
  backup/restore.
- Not yet tested in a real browser (dev server restart needed — Ryan has control of it).
