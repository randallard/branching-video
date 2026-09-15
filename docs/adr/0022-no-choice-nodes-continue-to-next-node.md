# ADR-0022: A node with no way forward continues into the next node in order
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
When a segment ends, the player used to route in this order: resume a captured branch point;
send an aside to its `returnTo`; show the node's `endScreen`; otherwise, with no choices, show a
generic "That's a wrap / Watch again" screen. So a node without choices stopped the show.

Slice 2's validator run showed what that means for real shows. The ukulele export
(`most-useful-music-theory-for-ukulele 3.json`) is eleven nodes cut from one master video, none
with choices — every segment stopped on "Watch again" instead of playing on. The published
Cardistry show (`public/live/cards-hummingbird-and-flutter.json`) has the same shape, seven steps.
Making each node continue meant hand-adding a default "Continue" choice to every one, and the
single-choice fix floated in `notes.txt` (skip the countdown for one default choice) would not have
helped, because these nodes have *zero* choices.

Asked directly, Ryan's answer: they should by default just continue with the video.

## Decision
When a segment ends and the node has no choices, is not an aside with `returnTo`, and has no
`endScreen`, the player navigates to the **next node in config order**. Only the last such node
falls back to the "Watch again" screen. The existing routes keep their precedence: choices,
resume-at-branch-point, aside `returnTo`, and `endScreen` all win over continuing.

The rule lives in `src/core/routing.ts` (`segmentEndAction`, `continuesToNext`), used by the
player and by the validator, whose reachability check follows the continue edge and whose
"dead end" warning now applies only to a last node that would show "Watch again".

## Alternatives considered
- **Keep stopping; require an explicit default choice to continue** — rejected by Ryan: the
  common authoring shape (slice one long video into chapters) should play through without extra
  wiring.
- **Continue to the node whose `start` equals this node's `end`** — rejected: timestamps drift
  (the ukulele file overlaps `399.2`/`399.4`), nodes can use separate videos, and list order is what
  authors already see and edit in Studio and Editor.

## Consequences
- The ukulele and Cardistry shows play straight through. For the Cardistry step-by-step tutorial
  that changes how it watches today: each step no longer pauses on a replay screen.
- A non-aside node with `returnTo` but no choices never routed to `returnTo` (the player only
  honoured it for asides); it now continues to the next node rather than stopping. The README
  describes `returnTo` more generally than the player implements — unchanged here.
- Node order in the config is now meaningful for playback, not just display.
