# ADR-1017: State is managed facts, managed position and derived values, and a screen's transitions go through one pure, property-tested reducer
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
This rule came from a project. The same split showed up twice. A game project and its successor
both derived the user's *position in the flow* from the data, and paid for it. A derived phase
skipped a results screen, so the stats update that lived on that screen never ran. A derived round
counter read "Round 6 of 5". In a third case, a stored copy of a preference went stale. In each
case the data was right, and where the user stood had been computed from it wrongly, or kept
twice. Later, a review screen in a third project kept one playhead in three hand-synchronised
places, and had a reload-on-a-keyframe bug caused by deriving "am I on a keyframe" before the
keyframes had loaded.

The lesson: deriving **facts about the data** is safe, and deriving **where the user is**, or
keeping a second copy of a fact, is not. It was recorded as a project ADR on 2026-10-18 and added
to `project-conventions` as prose that day, before ADR-1000 existed. That left the standard's
text without a record, citing projects a scaffolded repo can't see, and pointing at a "storage
default below" that isn't in that file. (The storage default lives in `new-project`, which is
deleted after bootstrap.) This ADR records the rule properly and closes those gaps.

## Decision
Every piece of state is exactly one of three kinds, each with one owner:
**managed facts** (stored once, in the form they were made: an append-only event log where
history or merging matters, a plain document otherwise; never copied); **managed position**
(where the user is; always stored explicitly, in the URL when a link should reopen it, otherwise
in the screen's reducer; never derived from facts, never kept twice); and **derived values**
(pure functions of the other two; never stored).

A screen with more than a handful of managed values keeps them in **one pure reducer** with named
actions. The reducer is core, so it gets **property tests over arbitrary action sequences**
(`fast-check` / `proptest`) that assert the screen's invariants, not only example-based unit
tests. A clock or canvas the screen doesn't own is read in at defined moments, never mirrored
continuously. There's no state library until a genuinely graph-shaped flow earns one by ADR.

## Alternatives considered
- **Leave state per screen.** Rejected: it works until a screen grows, and every growing screen
  rediscovered the problem.
- **A state library (XState, zustand, Redux Toolkit).** Not needed for the rule. XState stays
  the candidate for a genuinely graph-shaped flow.
- **Derive position wherever possible.** Rejected as a default. Deriving is fine only where the
  position really *is* implied by the facts (two parts collected *is* "assembled"). The bugs above
  are what it looks like when it isn't.
- **Unit tests only for reducers.** Rejected: "Round 6 of 5" is exactly what a property over
  arbitrary action sequences finds, and it puts the rule on rung 3 of ADR-1002's ladder.

## Consequences
- More files per screen (a reducer module and its properties). That's the point.
- Compliance review checks that stateful screens have a reducer with property tests. "Position
  is never derived" stays a reviewer's judgment, with the file cited.
- Promotion condition: if a reducer starts needing another screen's state, the layers are wrong
  for that pair. Decide a shared store in a new ADR.
