# ADR-0036: The player's position is one pure reducer
- Status: Accepted
- Date: 2026-10-31
- Deciders: Ryan

## Context
[ADR-1017](1017-state-is-managed-facts-managed-position-derived-values.md) says a screen with more
than a handful of managed values keeps them in one pure reducer with named actions, property-tested
over arbitrary action sequences. The 2026-10-31 [stance review](../reviews/2026-10-31-stance-review.md)
found the player is that screen and doesn't: its position lives in module variables in
`src/pages/player.ts` (the current node, the aside's branch point, whether the segment's choices
have shown, whether the segment has reached PLAYING), assigned across its handlers, with no
property tests. One more piece was read back from the DOM: "are choices showing?" was
`$choices.classList.contains("visible")`, and that class is added on the next animation frame.

The routing rule itself is already core and property-tested (`segmentEndAction`, `src/core/routing.ts`).
What isn't is the position it reads and writes.

Ryan chose this change from the review's three proposals.

## Decision
The player's position is one value, `Playback`, changed only by a pure reducer in
`src/core/playback.ts` with named actions: `navigate` (carrying the clock read as the segment is
left), `resume` (back to the branch point), `playing` and `show-choices`. Nothing hides choices
but leaving the segment: every way off them (a click, the countdown) navigates. It holds the
current node, where the segment started, the branch point, whether the segment is
ready, whether the mid-segment cue is spent, and whether choices are on screen. The questions the
page asks of it (is the cue due, is this ENDED real, is the backstop past `end`) are pure
functions beside it.

The page keeps what isn't position: the YouTube player, the poll and countdown interval handles,
and the DOM. It reads the clock in at defined moments (navigation, a poll tick, an ENDED event)
and never mirrors it.

Property tests over arbitrary action sequences assert the invariants:
- a branch point exists only while an aside plays, and always names a main-line node;
- choices appear at most once per segment, and "showing" implies the cue is spent;
- every navigation starts unready, and only `playing` makes a segment ready;
- the current node is always a node of the show (or none yet);
- `resume` returns to exactly the captured node and time, and consumes the branch point.

## Behaviour that changes, deliberately
- **A branch point is captured only by an aside.** The validator already warns that
  `returnAtCurrentTime` on a non-aside means "the resume button will not appear"; the old code
  showed it anyway. Now the code agrees with the warning.
- **A branch point is dropped on return to the main line by any route**, not only by resuming.
  Before, leaving an aside through a choice kept a stale branch point that a later nested aside
  could offer to return to.
- **"Choices are showing" is set when they're shown, not a frame later.** The old DOM check could
  miss choices shown in the same frame as a segment end, and show them twice.

## Alternatives considered
- **Leave it.** The routing rule is tested, and the e2e suite covers the player's flows. But the
  e2e tests run example paths; the bugs above lived between them, in the state's combinations.
- **A state-machine library.** ADR-1017 reserves one for a graph-shaped flow that earns it. Six
  values and four actions don't.

## Consequences
- Every player change that touches position goes through an action, and the property tests check
  it against sequences nobody wrote by hand.
- The timers stay effects in the page. If they ever need to be position (for example, to pause and
  restore a countdown across a reload), that's a new action and a new ADR.
- Promotion condition: if the player gains a second screen of state (a playlist, a history of
  choices made), revisit whether this reducer splits.
