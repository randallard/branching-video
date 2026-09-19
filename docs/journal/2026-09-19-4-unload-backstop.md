# ADR-0028: the unload backstop

After the `focusout` flush (entry 3), one gap was left: type in the Editor and close the tab
with the cursor still in the field, and the last burst relies on a `pagehide` flush the
browser won't wait for. Ryan asked whether we could catch the close. We can detect it, but we
can't finish an IndexedDB write during it. `localStorage` is synchronous, so the answer was to
park unsaved edits there and replay them on the next load.
[ADR-0028](../adr/0028-unload-backstop-in-localstorage-replayed-at-edit-time.md) has the decision.

## The part that took thought: what time a replay carries

My first instinct was to replay "now". That's wrong, and the unit test "never lets a replay
outrank an edit made after it" pins it down. The backstop is written on every *hide*, not
just on close (mobile can kill a background tab without `pagehide`). A page can also die after its
write landed but before it cleared its key. Either way the parked copy can be stale. Replayed
at "now", a stale copy wins last-writer-wins against every later edit and silently reverts
them. Stamped with the time the edit was made, it loses to anything newer and, being a diff
against the current state, adds nothing if it already landed. I checked the test fails when
replay is switched to "now" (1 failed, 14 passed).

## Identity at edit time

A replay goes through the ordinary diff, which keys nodes by `nodeKey`. A node added since the
last save had a `null` key until its write assigned one. So a replay of that edit would mint a
*different* key and duplicate the node if the original write had landed too. `DraftSession`
now assigns the show id and any missing node keys when the edit is **made** (`identify()` in
`note()`), so the in-flight write and the parked copy agree. A side effect: `session.showId`
is non-null from the first edit, before the first write lands. Nothing depended on the old
behaviour (the existing session tests all still pass).

`DraftStore` gained `peekNow()` (the timestamp `now()` would issue, without issuing it), an
optional `at` on `save()`, and `replay()`. `openDraftStore()` takes and replays every parked
entry, oldest first, before any page code runs. If the replay itself throws, the entries are
parked again under a fresh key.

## Found on the way: one failed save wedged the queue

`enqueue()` was `this.queue = this.queue.then(...)`. Once a save rejected, `queue` stayed
rejected, and every later `.then(...)` passed the rejection through without running. So one
failed IndexedDB write silently stopped every save for the rest of the session. It now chains
off a copy with the rejection caught, and the caller of the failed save still sees it fail.
Unit-tested with an event store whose append throws once.

## Verified

- `pnpm test` 125 → 135: `backstop.test.ts` (4: round trip across sessions, clearing, malformed
  entries skipped, a throwing `Storage`) and 6 in `draft-session.test.ts` (recovered after a
  close, never outranks a later edit, a landed edit replays to nothing, no duplicate node, key
  cleared once landed, failed save doesn't wedge).
- New e2e test: the closing tab's `IDBDatabase.transaction("readwrite")` is patched to throw, so
  only the backstop can carry the edit. `page.close({ runBeforeUnload: true })`, then a new page
  finds it (with ⟲ 1). It fails with the backstop write removed (`Received: "Intro"`).
  `pnpm e2e` 62 passed.
- Studio is covered too (`guardAgainstUnload` in both pages), though its saves were never
  debounced. They're still async, so a close mid-write could lose one.

## Not verified

A real mobile browser killing a backgrounded tab. That needs a phone, so it's added to the
manual list in `e2e/README.md`.
