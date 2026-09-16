# ADR-0024: A node deleted on one device and edited on another asks, rather than resolving silently
- Status: Accepted
- Date: 2026-09-15
- Deciders: Ryan

## Context
[ADR-0008](0008-edit-level-events-per-field-last-writer-wins.md) gives `node-removed` one line of
semantics: removal wins over later field sets on that node. Implementing the reducer surfaced two
cases it doesn't cover, both of which had to be decided to make `reduce` a total function:

- a later `node-added` on the same key — does the node come back?
- a `show-snapshot` after a removal — does the whole-show replacement wipe the removal?

The implementation answered yes to both, and those answers are fine as *defaults*. But the case
underneath them is not a defaulting problem. Delete a node on the laptop, edit that same node on
the phone, merge: one side meant it gone, the other was still working on it. Any rule picks one
and discards the other person's intent — and unlike a same-field edit, there is no later value to
fall back on, because the thing in dispute is whether the node exists at all.

This is the point ADR-0008 makes about conflicts: with two event sets there is no well-defined
conflict, so per-field resolution replaces the prompt. That holds for *values*. It holds less well
for existence, where the two outcomes are not two versions of a thing but a thing and nothing.

## Decision
The reducer keeps resolving deterministically — removal wins, a re-add lifts it, a snapshot clears
it — so the app is never blocked, works offline, and stays a pure function of the event set.

On top of that, a delete-versus-edit collision is **reported to the person, in the moment they
would care**, and their answer is recorded as a new event. The reduced state carries the collision
as a derived fact, computed from the same events; the UI raises it when the merge lands rather
than filing it somewhere to be discovered later; and choosing an outcome appends an ordinary
`node-removed` or `node-added`, which resolves it the same way any edit resolves anything.

Nothing about this blocks an import. The default has already been applied by the time the person
is told; the notification offers to change it, not to permit it.

## Alternatives considered
- **Leave the implementation's defaults silent** — what slice 3a does today. Rejected by Ryan: a
  node vanishing because another device deleted it while you were editing it is exactly the kind
  of loss you should hear about at the time, not discover later.
- **Block the import with a prompt** — rejected for ADR-0008's reasons, and because it makes an
  offline merge impossible to complete without a person present.
- **Record the person's answer as a resolution rather than an event** — rejected: anything that
  decides state outside the event set breaks the property the whole design rests on, that two
  devices holding the same events compute the same shows.

## Consequences
- This does **not** reinstate the keep-mine/keep-backup/keep-both screen ADR-0002 had and ADR-0008
  retired. That screen gated the import and made the person choose between whole documents before
  anything could land. This lands everything, then reports one specific thing. A future reader
  should not read this as reversing ADR-0008.
- `reduce` gains a derived output beyond the shows themselves — the collisions it noticed. That is
  new surface on the core's return type, and every caller has to decide whether to show it.
- The notification needs a moment to fire in, which means the merge has to be something the UI
  observes rather than a silent background fold. It constrains how import is wired in slice 3b.
- An answer is an ordinary event, so it merges and can itself be superseded. Two devices answering
  the same collision differently resolve by `(at, id)` like anything else, and the loser's answer
  stays in the log.
- **Promotion condition:** if collisions turn out to be common enough that the notification is
  noise, that is evidence the edit model is too coarse, not that the notification is wrong —
  revisit via an ADR on the event granularity, not by muting this.
