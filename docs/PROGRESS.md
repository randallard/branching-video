# Progress & Status

_Last updated: 2026-07-08_

## What this is

A self-hosted interactive video player for non-linear storytelling (branching "choose your
path" video), built on YouTube's free infrastructure — no backend, no platform fees. A show is
a `config.json` (nodes, choices, defaults) plus a single HTML player. Studio (`studio.html`) is
the in-browser builder; Editor (`editor.html`) is a form-based editor; `index.html` lists
local drafts (from `localStorage`) and published shows (from `live/`).

## Status / next

**No hard deadline** — active side project, iterate as time allows.

**Just landed (2026-07-08):** "Export All" / "Import All" on the home page, so all local
drafts can move between browsers/machines as one JSON file instead of per-video download —
plus, on top of that, real merge-conflict handling on import: only-in-backup drafts are added
automatically, identical same-slug drafts are left alone, and same-slug drafts that differ on
each side prompt a per-item choice (keep mine / keep backup / keep both — default keep both,
added under `<slug>-imported`). See [ADR-0001](adr/0001-bulk-backup-single-json-bundle-merge-by-slug.md)
(superseded on the overwrite behavior) and [ADR-0002](adr/0002-import-conflict-resolution-per-draft-choice.md)
(current), plus [journal/2026-07-08](journal/2026-07-08.md) and
[journal/2026-07-08 (2)](journal/2026-07-08-2-import-merge-conflicts.md). **Not yet committed
or tried in a real browser** — needs a dev server restart (Ryan controls it) and a manual pass
across two profiles/devices with an overlapping, divergently-edited slug before calling it
verified.

**Open from `notes.txt` (pre-existing, not yet actioned):**
- Single-choice nodes force an 8s countdown + meaningless "Continue" button; the fix (skip
  the choice UI and auto-advance immediately when a node has exactly one, default choice) was
  scoped as "a 3-line change in `onSegmentEnded`" but not yet made.
- Chapter menu may want to split into "Main chapters" vs "Deep dives" sections if it reads as
  cluttered on mobile — feedback pending.
- Mermaid-diagram chapter maps floated as a maybe.

## Open questions

- Conflicting drafts default to "keep both," which accumulates `-imported` / `-imported-2`
  copies over repeated multi-device merges — there's no UI yet to help clean those up, just
  deleting them by hand in Studio.
- Conflict detection is `JSON.stringify` equality, not semantic — reordered-but-equivalent
  JSON would register as a false conflict. Not expected in practice; not addressed.
- No size ceiling has been considered for the all-drafts bundle — fine while configs are small,
  unverified at scale.

## Log

- **2026-07-08** — Investigated storage (all `localStorage`, no bulk export existed); added
  Export All / Import All to `index.html` ([e97075d](https://github.com/randallard/branching-video/commit/e97075d));
  recorded the format/merge decision as [ADR-0001](adr/0001-bulk-backup-single-json-bundle-merge-by-slug.md);
  stood up `docs/adr/` + `docs/journal/` for the project and linked it from
  `~/Development/work/README.md`.
- **2026-07-08 (2)** — Replaced the blind overwrite-by-slug import with per-conflict resolution
  (keep mine / keep backup / keep both) so importing a backup from another device can't
  silently drop local drafts; recorded as [ADR-0002](adr/0002-import-conflict-resolution-per-draft-choice.md),
  superseding ADR-0001's overwrite behavior. Not yet committed — pending Ryan's local
  verification.
