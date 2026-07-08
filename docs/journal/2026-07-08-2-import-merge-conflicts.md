# 2026-07-08 (2)

Documents the working-tree changes to `index.html` on top of
[e97075d](https://github.com/randallard/branching-video/commit/e97075d) — not yet committed,
pending local verification.

## The problem with the first cut

Export All / Import All (ADR-0001) landed as a blind merge-by-slug: importing a backup would
silently overwrite any local draft that happened to share a slug with one in the file. Raised
directly: importing a phone-exported backup on a laptop that also has its own local drafts —
some possibly under the same slugs, edited independently on each side — "I don't want to lose
those."

## What changed

`importAllDrafts` now classifies every incoming draft before touching `localStorage`:

- present only in the backup → added automatically
- present on both sides with identical JSON → left alone
- present on both sides with different JSON → held back as a **conflict**

If there are no conflicts, import still applies immediately (unchanged from before). If there
are conflicts, a modal (`openMergeModal`) lists each one with both sides' modified timestamps
and a per-item choice — keep mine / keep backup / keep both (default) — before `applyMerge`
touches storage. "Keep both" adds the backup's version under `<slug>-imported` (bumping to
`-imported-2` etc. on further collision) so neither version is discarded.

Decision recorded as [ADR-0002](../adr/0002-import-conflict-resolution-per-draft-choice.md),
which supersedes ADR-0001's overwrite-by-slug behavior (the bundle format itself is unchanged).

## Next

- Not yet exercised against real browser storage across two profiles/devices — needs a manual
  pass (export from one profile with an overlapping-slug draft edited differently, import into
  another, confirm the modal appears and each of the three actions behaves as expected) before
  this is committed.
- `-imported` copies accumulate on repeated conflicting merges and are expected to be cleaned
  up by hand in Studio; no UI for that cleanup yet.
