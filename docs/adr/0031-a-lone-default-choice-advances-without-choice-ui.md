# ADR-0031: A node whose only choice is the default advances to it without showing choices
- Status: Accepted
- Date: 2026-10-31
- Deciders: Ryan

## Context
A node with exactly one choice, marked default, ends its segment by showing a single button
(usually "Continue") and running the `choiceDisplaySeconds` countdown (8 s by default) before
firing that same choice. The button can only do what the countdown is about to do anyway: it is
a "skip the wait" control, and every such transition costs the viewer the wait. The published
Big Buck Bunny show (`public/live/big-buck-bunny.json`) has two of these, `intro` and
`chapter-2`.

The fix was floated in `notes.txt` before slice 2. [ADR-0022](0022-no-choice-nodes-continue-to-next-node.md)
then settled the larger case it was first raised for (nodes with *zero* choices, which now play on
into the next node in order) and noted that this one would not have helped there. It stayed in the
PROGRESS backlog as its own item; Ryan scheduled it on 2026-10-31.

What a reasonable person might get wrong: treating it as ADR-0022's `continue`. It isn't. The
lone choice's target can be any node, not the next one in config order, so it is a separate route
to the choice's target.

## Decision
When a segment ends and the node has **exactly one choice and that choice is the default**, the
player navigates straight to that choice's target: no choice buttons, no countdown. It takes
precedence over the other segment-end routes, as showing that node's choices did.

The rule lives in the routing core, `src/core/routing.ts` (`autoAdvanceTarget`, and the
`auto-advance` result of `segmentEndAction`), property-tested there and driven end to end by
`e2e/player.e2e.ts`.

Unchanged:
- **A single choice that is not the default** still shows its button and waits: there is no
  countdown to skip, so the viewer is still deciding.
- **Two or more choices** behave exactly as before, default or not.
- **Mid-segment choices** (`showChoicesAt`): if the author asked for the choice to appear while
  the segment plays, it still appears, and the countdown already on screen owns the next step.
  The rule applies only where the choices would otherwise first appear at the segment's end.

## Alternatives considered
- **Leave it; authors can remove the choice.** Then ADR-0022 sends the node to the next node in
  *order*, which is not the same as the choice's target. Authors would have to reorder nodes to
  get the same playback, and order is what they see and edit in Studio and the Editor.
- **A shorter countdown for single-choice nodes.** Still a wait that buys nothing.
- **A new per-node `autoAdvance` flag.** The config format is frozen to additive optional fields
  (ADR-0010) and the player, `live/`, and cycle-in all parse it. The existing `default: true` on a
  lone choice already says everything the flag would.

## Consequences
- Big Buck Bunny's `intro → chapter-1` and `chapter-2 → aside-default` transitions become
  seamless cuts. `chapter-1`'s "Deep dive / Continue" fork is untouched.
- An author can no longer make a viewer pause on a single default "Continue" at a segment's end.
  If that pause is wanted, `showChoicesAt` (show it mid-segment) or a non-default choice still
  gives it.
- The Editor's checkbox caption, "auto-advance after countdown", is now inexact for a node's only
  choice (it advances at once). Not changed here.
- The validator is unaffected: its reachability check already follows choice targets.
- Revisit if authors report wanting the pause back. A per-show opt-out would be the additive way
  to give it.
