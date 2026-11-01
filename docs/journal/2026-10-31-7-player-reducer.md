# 2026-10-31 (7) — the player's position, in one reducer

Branch `player-reducer`, stacked on `pnpm-12` (PR #41). The third of the stance review's
follow-ups. ADR first (`8028afb`), then the change (`9d7af48`).

## What changed

[ADR-0036](../adr/0036-the-players-position-is-one-pure-reducer.md). `src/core/playback.ts` holds
`Playback` (node, segment start, branch point, ready, cue spent, choices visible) and
`reducePlayback` with four actions: `navigate` (carries the clock as the segment is left),
`resume`, `playing`, `show-choices`. The page's three questions are pure functions beside it:
`cueDue`, `endIsReal`, `pastEnd`. `player.ts` keeps only effects (the YouTube player, the poll and
countdown handles, the DOM) and goes through `dispatch`. `navigateTo(id, seekOverride)` became
`navigateTo(id)` plus `resumeBranch()`, both via one `enter(action)`.

## What the property tests found

The first draft had a `clear-choices` action. The "choices at most once per segment" property
failed on show, clear, show. In the page every clear is followed by a navigation, so the action
modelled nothing real; it went, and choices now leave only with the segment.

## Behaviour that changed on purpose

- Only an aside takes a branch point. The validator already warned that `returnAtCurrentTime` on
  a non-aside means no resume button; the code showed one anyway.
- Reaching the main line by any route drops the branch point. Before, leaving an aside through a
  choice left a stale one a later nested aside could offer.
- "Choices are showing" was `$choices.classList.contains("visible")`, a class added on the next
  animation frame; it's now set synchronously.

Duplicate node ids (a validator error, but the player still loads) resolve to the last match in
the reducer, as the page's `nodeMap` does.

## Gates

tsc, lint, casts (25, unchanged), 156 unit (11 new), 77 e2e. The e2e suite fakes YouTube, so the
real IFrame player's event timing isn't covered by any of this.

## Next

1. CI on #40, #41 and this PR; merge in order #40 → #41 → this.
2. Ryan: play a branching show with an aside live on real YouTube (the Big Buck Bunny show or the
   e2e `branching.json` shape): mid-segment choices, the countdown, "Back to where I was", and an
   aside left through a choice (should no longer offer a stale return).
3. The stance review's three proposals are then all done; next look is due 2026-11-30 (30 days).
