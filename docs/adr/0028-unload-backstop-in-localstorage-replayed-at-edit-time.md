# ADR-0028: Edits not yet in IndexedDB are parked in localStorage on unload and replayed at edit time
- Status: Accepted
- Date: 2026-09-19
- Deciders: Ryan

## Context
[ADR-0007](0007-indexeddb-append-only-event-log-storage.md) keeps drafts in IndexedDB, which is
asynchronous. A page that is closing (tab closed, browser quit, a phone killing a background
tab) doesn't wait for asynchronous work, so a write still pending at that moment can be lost.

That window used to be tiny. Then the Editor started coalescing a typing burst into one write,
1 s after the last keystroke, to meet ADR-0007's own coalescing rule and keep
[ADR-0023](0023-per-field-value-history.md)'s history readable. That made the window up to a
second: type, close the tab, and the burst can be gone. A `focusout` flush narrows it for the
common case (clicking a link), but not for closing the tab with the cursor still in the field.

Detecting the close is easy; `pagehide` and `visibilitychange` fire. What a closing page can't do
is finish an IndexedDB write. `localStorage` is synchronous and does complete.

The non-obvious part is **what time a replayed edit carries.** The obvious choice, "now, when
it's replayed", is wrong. The parked copy can be stale: the backstop is written every time a tab
is hidden, not just when it closes, and a page can die after its write landed but before it
cleared the parked copy. Replayed at "now", a stale copy would outrank everything written after
it and silently revert those edits, the same kind of silent loss this exists to prevent.

## Decision
Whenever a page with an open draft session is hidden or unloads, it starts the ordinary flush
**and** synchronously writes every edit not yet confirmed in IndexedDB to `localStorage`, under a
key unique to that session (`bvp:unsaved:<session id>`). The next page to open the draft store
takes every parked entry and replays it through the ordinary diff, **stamped with the time the
edit was made**. The session clears its own key once everything it parked has landed.

Two supporting rules make replay safe:

- **Ids are assigned when the edit is made**, not when it is written. A new show's id and a new
  node's key are fixed at edit time, so an in-flight write and a replay of the same edit agree on
  identity. A replay of a write that did land then produces no events, rather than a duplicate
  node.
- **Replay is a diff against the current state at the edit's own time.** So under
  [ADR-0008](0008-edit-level-events-per-field-last-writer-wins.md)'s last-writer-wins, a stale
  parked copy loses to anything written after it, and a copy of what's already stored adds
  nothing.

## Alternatives considered
- **A `beforeunload` "you have unsaved changes" prompt.** More certain within its narrow case,
  but it interrupts after nearly every quick edit. It's the prompt slice 3b.3 deliberately removed
  when the Editor went draft-first.
- **No debounce: write every keystroke immediately.** Brings back the near-zero window, but breaks
  ADR-0007's coalescing and floods ADR-0023's history with every prefix typed.
- **Park only on `pagehide`, not on hide.** Avoids most stale copies, but mobile browsers can kill
  a backgrounded tab without ever firing `pagehide`; `visibilitychange` → hidden is the last
  reliable signal there. Stale copies are made harmless by the edit-time stamp instead.

## Consequences
- Closing a tab, quitting the browser or having a phone kill a background tab no longer loses the
  last edit, as long as `localStorage` is available. Covered by a browser test that makes the
  closing page's IndexedDB writes fail, and fails if the backstop is removed.
- `localStorage` now holds real (if short-lived) draft data, not just page-to-page plumbing. It's
  best effort: a full or blocked `localStorage` means no backstop, never a broken page.
- A replayed edit shows in ADR-0023's history at the time it was made, which is true.
- Clock skew matters here exactly as much as it does under ADR-0008, no more.
- **Promotion condition:** if the log ever gains compaction or snapshotting (deferred by
  ADR-0007), that ADR must say how it treats a replay whose timestamp predates the compaction
  point.
