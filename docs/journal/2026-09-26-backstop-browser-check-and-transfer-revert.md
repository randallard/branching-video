# Backstop checked in a real browser; the transfer path can revert edits

Documents [0237797](https://github.com/randallard/branching-video/commit/0237797) (ADR-0028,
PR #18), which is the 2026-09-19 (4) work with its commit message reworded. The code is unchanged.

## What Ryan saw

For step 2 of the manual check ("change a node title, close the tab, reopen, load the draft"),
Ryan reported the new title but **no ⟲ badge**, and **two drafts with the same title** in My
Drafts. Both looked like backstop bugs.

## What the log says

I read the `localhost` event log directly without writing to it. The show had four events:

| at (UTC)     | event                                          | intro title |
|--------------|------------------------------------------------|-------------|
| 17:36:59     | `node-field-set` on the original show          | → `intro1`  |
| 17:37:25     | `show-snapshot` **onto** the original show     | `intro`     |
| 17:37:50     | `node-field-set` on the original show          | → `intro1`  |
| 17:38:33     | `show-snapshot` for a **new** show id          | `intro1`    |

`show-snapshot` is only emitted by `importConfig`. Nothing in the backstop or `DraftSession`
emits it. Both snapshots came from `adoptConfig`, which is the `#transfer` handoff between
Studio and the Editor (or a file open) going through ADR-0011's update-or-add `confirm`:

- 17:37:25 was "OK, update", carrying a **stale** copy (`intro`) that reverted the first edit.
- 17:38:33 was "Cancel, add as new", which made the duplicate.

The missing badge was correct. My Drafts lists the new copy first. That copy's only event is its
snapshot, so it has no history. The original shows ⟲ 1 (`intro`, imported 17:37:25).

## The backstop itself, in Chrome

I ran this on `127.0.0.1:8080`, a separate origin with its own storage, so Ryan's drafts weren't
touched:

- **Step 3 (IndexedDB writes forced to fail):** The first edit landed normally and created the
  draft. After the IndexedDB `transaction` monkey-patch I typed "Intro B" and closed the tab at
  once. Reading `localStorage` from a non-app URL before any Editor booted showed
  `bvp:unsaved:<id>` holding "Intro B". The next Editor replayed it and deleted the key. Loading
  the draft showed **Intro B ⟲ 1**.
- **Add a node, close at once:** After reopening there was one show with 7 nodes and 7 distinct
  node keys, so no duplicate.
- **Not run:** step 4 (a stale hide-time copy doesn't win) and step 5 (Studio). A real tab switch
  can't be driven reliably from the extension. Step 4's logic is pinned by the unit test "never
  lets a replay outrank an edit made after it".

## The real finding: the transfer path can revert newer edits

This isn't new with ADR-0028; `main` has it too. "Open in Studio" / "Open in Editor" copies the
whole config through `bvp:transfer`, and the receiving page imports it as a snapshot. If the
sending tab's copy is older than the draft (for example, a Studio tab left open while the Editor
edited), "update" overwrites every field with the older values. Each field's history still
has the newer value, so ⟲ can recover it field by field. But nothing warns you, and "add as
new" makes a second draft. Given ADR-0007, a handoff between two pages on the same device
could pass the **show id** instead of the config. Then there would be nothing to import and
no question to ask. That needs its own ADR, and it isn't written yet.
