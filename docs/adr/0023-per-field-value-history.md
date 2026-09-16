# ADR-0023: A superseded field value is recoverable from a per-field history
- Status: Accepted
- Date: 2026-09-15
- Deciders: Ryan

## Context
[ADR-0008](0008-edit-level-events-per-field-last-writer-wins.md) resolves two devices editing the
same field by the greater `(at, id)` — the later clock wins. It names the cost in its own
consequences: *"the losing event stays in the log, so a later history view could recover it. That
view is not built."*

So the data loss is only apparent. Every value a field has ever held is still in the log, because
the log is append-only and nothing is ever edited in place. What is missing is any way to see it.
Today a value that loses is indistinguishable, to the person looking at the screen, from a value
that was never typed.

That is the part worth fixing. The resolution rule itself is fine — it is deterministic, it needs
no prompt, and it lets an import happen without a decision. What is not fine is that the person
cannot tell it happened, or get the other value back, and the likeliest case is the one where it
matters most: edits made on a phone away from the laptop, discovered days later.

Asked whether to build a recovery view or accept the loss, Ryan chose to build one, and chose its
shape: **per field — "what else has this been"** — rather than a per-show changelog.

## Decision
A field whose current value superseded a different one exposes its prior values, in place, as a
per-field history: for that one field, what else it has been, when, and — where the log can tell —
from which append.

The history is **derived**, not stored: it is computed from the same event set the reducer already
folds, so it needs no new event kind, no migration, and nothing added to a bundle. A device that
holds the events can always reconstruct it, and a device that doesn't never could.

Recovering a prior value is an ordinary edit. Choosing an old value appends a new
`show-field-set` / `node-field-set` with a current timestamp; it does not rewrite, retract or
reorder anything. The old value wins the way any edit wins, and the value it displaces becomes
part of the same history.

## Alternatives considered
- **Accept the loss** — the status quo, and cheapest. Rejected by Ryan: the loss is silent, and a
  silent loss in a tool you sync between a phone and a laptop is exactly the failure the event log
  was adopted to prevent.
- **A per-show "what changed and when" log** — a single chronological view of the whole show. It
  answers "what happened here?" well, but answers "what else has this title been?" badly: you scan
  a stream looking for entries about one field. Rejected in favour of putting the history where
  the field is, which is where the question is actually asked.
- **A conflict prompt at import time** — rejected for the reasons ADR-0008 already gives: with two
  event sets there is no well-defined conflict to prompt about, and a prompt blocks an import that
  otherwise needs no decision.

## Consequences
- Per-field last-writer-wins stops being lossy in practice. ADR-0008's resolution rule is
  unchanged; this is the recovery path it assumed someone would build.
- Every page that edits a field gains an affordance, so this is UI work across Studio and the
  Editor, not one view in one place. It is the cost of putting the history where the question is.
- The history is only as deep as the log. Compaction is deferred by
  [ADR-0007](0007-indexeddb-append-only-event-log-storage.md), but whenever a snapshotting ADR
  arrives it must state what it does to history depth — that is a real constraint on it, not an
  afterthought.
- Clock skew is visible now. A device with a badly wrong clock already won or lost unfairly under
  ADR-0008; it will now do so in a list with a misleading timestamp next to it. Accepted, as there.
- **Cannot start before slice 3b.** Until Studio and the Editor emit per-field events there is no
  superseded value to recover, and every field's history is a single entry.
- **Promotion condition:** if per-field history turns out to be how the whole edit history gets
  read — people opening it to understand a show rather than to recover one value — revisit the
  per-show view with a new ADR rather than growing this one.
