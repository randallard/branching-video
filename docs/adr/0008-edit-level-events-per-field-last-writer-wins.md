# ADR-0008: Edit-level events, resolved per field by last writer
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
[ADR-0007](0007-indexeddb-append-only-event-log-storage.md) puts drafts in an event log but
leaves open how coarse an event is — the choice that decides what a two-device merge keeps.

- **Whole-config snapshots** (`show-saved { config }`) are the smallest change to Studio and
  Editor, which already serialize the full config on every autosave. But a merge of two
  devices' snapshots can only pick one whole config: edit node timings on the phone and choice
  labels on the laptop, and one side's work drops out of the current state. That is the exact
  loss [ADR-0002](0002-import-conflict-resolution-per-draft-choice.md) exists to prevent, with
  its conflict screen removed.
- **Edit-level events** let independent edits to different fields both survive a merge.

A config is a small graph: top-level settings, an ordered node list, and per-node fields and
choices. A node's `id` is user-editable and is what URLs and choice `target`s reference, so it
cannot double as a stable key.

## Decision
Event kinds (v1), all scoped by `showId`:

| Kind | Payload | Resolves |
|---|---|---|
| `show-snapshot` | full normalized config | replaces the whole show as of its `(at, id)` |
| `show-field-set` | `field`, `value` (title, startNode, masterVideoId, choiceDisplaySeconds) | per field, last writer |
| `node-added` | stable `nodeKey`, initial node, `order` | — |
| `node-field-set` | `nodeKey`, `field`, `value` (incl. `id`, `start`, `end`, `order`, …) | per node field, last writer |
| `node-choices-set` | `nodeKey`, full `choices` array | per node, last writer (choices are short and edited as a list) |
| `node-removed` | `nodeKey` | removal wins over later field sets on that node |
| `show-deleted` / `show-restored` | — | last writer |

"Last writer" is the greatest `(at, id)`; with ids unique this is a deterministic total order,
so every device that holds the same event set computes the same shows. Edits after a
`show-snapshot` apply on top of it; edits before it are overwritten by it.

Node order is a sortable `order` string per node (fractional keys), so a concurrent insert on
two devices keeps both nodes instead of conflicting over a whole order array.

## Alternatives considered
- **Whole-config snapshots only** — simplest; rejected in this proposal because divergent
  edits on two devices silently collapse to one side, undoing ADR-0002's guarantee.
- **Per-choice events** — finer than needed: choices are edited as a small list, and
  per-choice ordering adds complexity no real edit pattern needs.
- **Keep a conflict screen on top of events** — rejected: there is no well-defined "conflict"
  once both sides are just events; per-field resolution is what replaces it.

## Consequences
- Supersedes [ADR-0002](0002-import-conflict-resolution-per-draft-choice.md): no keep-mine/keep-backup/keep-both screen for event
  bundles. Two devices editing the **same field** still resolve to one value — but the losing
  event stays in the log, so a later history view could recover it. That view is not built.
- Studio and Editor must emit diffs, not snapshots: the shell compares the edited config with
  the reduced one and appends one event per changed field (which also gives the coalescing
  ADR-0007 requires).
- Device clocks decide "last": a device with a badly wrong clock wins or loses unfairly. Accepted
  for a single-user tool; revisit if it bites.
