# ADR-0034: The Editor and Studio edit a working copy that is diffed into events
- Status: Accepted
- Date: 2026-10-31 (the design dates from slice 3b, 2026-09-15 to 09-18; recorded here as an exception to ADR-1017)
- Deciders: Ryan

## Context
[ADR-1017](1017-state-is-managed-facts-managed-position-derived-values.md) says managed facts are
"stored once, in the form they were made … never copied". This project's facts are the event log
([ADR-0007](0007-indexeddb-append-only-event-log-storage.md)). But the Editor and Studio don't edit
the log. Each holds a whole `ShowConfig` in memory (`config` in `src/pages/editor.ts` and
`studio.ts`), mutates it directly as the user types, and the draft session turns each
autosave into events by diffing it against what's stored
(`src/core/diff.ts`, through `DraftSession.persist` / `persistSoon`).

So there is a second copy of a fact, by design. The 2026-10-31
[stance review](../reviews/2026-10-31-stance-review.md) found that no ADR recorded it, and Ryan
asked for it recorded rather than refactored.

Why it was built this way (from `diff.ts`'s own header and slice 3b):
- **Per-field events are what let two devices merge.** Writing the edited config into the log
  as a snapshot would work too, but two snapshots can only merge by picking one, losing a
  phone's timing edits or a laptop's label edits. A diff yields one event per *changed field*
  ([ADR-0008](0008-edit-level-events-per-field-last-writer-wins.md)).
- **It is the coalescing ADR-0007 asks for.** One event per field that actually moved, per
  save, not one per keystroke.
- **The pages predate the event log.** Both were full config editors before slice 3; routing
  every input through event-shaped actions would have rewritten most of 2,000 lines of UI to
  get the same events.

## Decision
The Editor and Studio keep a **working copy**: a `WorkingShow` (the `ShowConfig` plus node keys
aligned by position), which the page mutates freely. It is never persisted as itself. The
event log stays the only stored fact; the working copy reaches it only through the diff
emitter, as one event per changed field. Nothing else reads the working copy as a source of
truth: other pages, other tabs and other devices read the log.

The other temporary copy, the unload backstop in `localStorage`
([ADR-0028](0028-unload-backstop-in-localstorage-replayed-at-edit-time.md)), follows the same
rule: it holds unsaved edits only until they're replayed through the diff emitter.

This is the project's recorded deviation from ADR-1017's "never copied", per ADR-1000.

## Alternatives considered
- **Edit the log directly**, each input dispatching an event-shaped action through a reducer,
  with the page rendering from the fold. That is ADR-1017's letter. Lost on cost and benefit:
  the same events come out of the diff, and the rewrite touches nearly all of both pages.
- **Snapshot events.** Simpler, and it loses edits on every concurrent change (ADR-0008).

## Consequences
- The diff emitter carries the correctness of every edit. It is pure and property-tested
  (`src/core/diff.test.ts`), and its node matching by key is what keeps a rename a rename
  ([ADR-0025](0025-snapshot-node-keys-derived-from-node-id.md)).
- The working copy can drift from the log between saves. The autosave cadence and the backstop
  bound how far: a burst of edits, never longer than the next save or the next page load.
- ADR-1017's position rule is unaffected: `selectedId`, the open draft (`#show=<id>`,
  [ADR-0029](0029-same-device-handoffs-carry-the-show-id-not-the-config.md)), and the player's
  position (a separate decision) are position, not facts.
- Promotion condition: revisit if the diff emitter starts needing to infer intent it can't see
  (an edit that looks like a delete and an add), or if a third page edits shows. Either says
  the pages should dispatch events instead.
