# ADR-0007: Drafts live in an IndexedDB append-only event log; backups are event bundles
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
Supersedes [ADR-0001](0001-bulk-backup-single-json-bundle-merge-by-slug.md) — the half of it
that [ADR-0002](0002-import-conflict-resolution-per-draft-choice.md) left standing: the
`bvp-backup` bundle of whole configs keyed by slug.

Today drafts are mutable documents in `localStorage` (`bvp:index`, `bvp:config:<slug>`).
Moving between devices means exporting whole documents and deciding, per slug, whose version
wins — which is why ADR-0002 needed a conflict screen, and why Studio's separate import path
(which autosaves straight over a same-titled draft) can still lose work. Every new import path
has to re-implement those merge rules or bypass them.

The template's storage default is IndexedDB with an append-only event log and union-merge
import. [cycle-in's ADR-0003](https://github.com/randallard/cycle-in/blob/main/docs/adr/0003-append-only-event-log-core.md)
implements it, including the IndexedDB store and the bundle format. Offered three options
(keep `localStorage` documents; IndexedDB documents; IndexedDB event log), Ryan chose the event
log.

## Decision
- All draft changes are immutable events `{ id, at, v, kind, ...payload }` appended to an
  IndexedDB object store keyed by `id`. Appends are idempotent (`put`).
- A pure reducer in `src/core/` folds the event **set** into the current shows: dedupe by id,
  sort by `(at, id)`, fold. Unknown kinds are skipped, never an error.
- **Export All** writes an event bundle (`{ format: "branching-video-events", bundleVersion,
  exportedAt, events }`); **Import All** unions it into the store by event id. Importing can add
  events, never remove them.
- The event kinds and how concurrent edits resolve are
  [ADR-0008](0008-edit-level-events-per-field-last-writer-wins.md); show identity is
  [ADR-0009](0009-show-identity-by-generated-id-not-slug.md); single-show config files stay
  the publish format ([ADR-0010](0010-config-json-stays-the-publish-and-interchange-format.md));
  existing drafts and old backups carry over via
  [ADR-0011](0011-legacy-drafts-and-backups-import-as-snapshot-events.md).

## Alternatives considered
- **Keep `localStorage` documents behind a storage module** (recommended at the time for zero
  migration) — rejected by Ryan: keeps whole-document merging and its per-import conflict logic.
- **IndexedDB with the same document model** — rejected: removes the size ceiling but not the
  merge problem, which is the actual pain.

## Consequences
- Multi-device merging stops being a per-import-path decision: every path produces events, and
  union is the only merge.
- The store needs a one-time migration from `bvp:*` keys (ADR-0011).
- The log grows forever; Studio autosaves often, so edit events must be coalesced (e.g. one
  event per field per edit burst) rather than emitted per keystroke. Compaction is deferred.
  **Promotion condition:** revisit with a snapshotting ADR if a real bundle passes a few MB or
  reduce time is noticeable on page load.
- Clearing site data now loses the whole log, as it lost `localStorage` before; Export All
  remains the backup.
