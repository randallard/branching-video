# ADR-0029: Handoffs between pages on the same device carry the show id, not the config
- Status: Accepted
- Date: 2026-09-26
- Deciders: Ryan

## Context
Four buttons send a draft from one page to another. Three of them, Studio's "Open in Editor", the
Editor's "Open in Studio" and the home page's "Editor" link, serialize the whole config
into `bvp:transfer`, open `editor.html#transfer` or `studio.html#transfer`, and the receiving page
runs it through `adoptConfig`. That is the path
[ADR-0011](0011-legacy-drafts-and-backups-import-as-snapshot-events.md) built for **config files**,
which have no identity. It writes a `show-snapshot` and, when the title matches a show, asks
"update that draft, or add as a new one?".

The handoff reused that path in slice 3b.3 because the receiving page already had it. But a
handed-off config isn't identity-less. The sender knows exactly which show it came from, and
treating it as a file loses that in two ways, both seen in a real browser on 2026-09-26
([journal](../journal/2026-09-26-backstop-browser-check-and-transfer-revert.md)):

- **"Update" can revert newer edits.** A snapshot sets *every* field. If the sending tab's copy is
  older than the log, for example a Studio tab left open while the Editor was edited, every field
  the Editor changed goes back to its old value. Last-writer-wins
  ([ADR-0008](0008-edit-level-events-per-field-last-writer-wins.md)) picks the snapshot because it
  is the newest write. The per-field history ([ADR-0023](0023-per-field-value-history.md)) can
  recover each field, one at a time, if you notice.
- **"Add as new" makes a same-titled duplicate** of a show the person was only trying to open.

The prompt exists "only because a config file has no identity" (ADR-0011's own consequence). A
handoff has one, so here the prompt is answering a question that didn't need asking.

The fourth, the home page's "Studio" link, already sends only the id, but through `bvp:resume`: a
single `localStorage` key that Studio reads and deletes at the end of its boot. That has problems
of its own. If Studio never reaches that point (the person clicks back while the store is opening,
or boot takes an early return such as a `#transfer` arrival), the key is left behind, and the next
plain visit to `studio.html` opens that old draft instead of the setup screen. The key is gone
after the first load, so reloading Studio drops you on the setup screen. And two tabs handing off
at once write the same key.

What makes this non-obvious is **timing**. The sender's latest edit may not be in IndexedDB yet
(the Editor holds a typing burst for 1 s, and every write is asynchronous). Sending only the id
could open a copy one edit behind. Awaiting the write before opening the tab would lose the
click's user activation, and the browser may then block the popup.

## Decision
When Studio, the Editor or the home page hands a draft to another page in the same browser, it
passes the **show id** in the URL, as `editor.html#show=<showId>` or `studio.html#show=<showId>`.
The receiving page opens that show from the draft store. Nothing is imported, and no question is
asked. That covers all four handoffs, the home page's "Studio" link included, and `bvp:resume` is
removed. While a show is open, the Editor and Studio keep `#show=<id>` in the URL, so reloading
reopens it.

The sender, still inside the click handler and before calling `window.open`, does
[ADR-0028](0028-unload-backstop-in-localstorage-replayed-at-edit-time.md)'s park synchronously:
start the flush **and** write the backstop. The receiving page's `openDraftStore()` replays the
backstop before it opens anything, so it sees the sender's latest edit even if that write hasn't
landed. A show with no id yet (an example the person hasn't edited) is persisted first. That
assigns its id at once (ADR-0028's ids-at-edit-time rule), and the draft is created before the
handoff. This matches today's behaviour, where the import created it.

`#transfer` and `bvp:transfer` stay only for the Player (`player.html?config=transfer`). The Player
plays the config and never imports it, so it has neither problem.

## Alternatives considered
- **Keep sending the config, but include its show id and snapshot onto that id without asking.**
  This removes the duplicate but keeps the revert: the whole-config snapshot still outranks newer
  edits. It would need a diff against the sender's base version, which the config doesn't carry.
- **Keep sending the config, and diff it (not snapshot it) against the show.** Stale fields would
  still be written as new edits and still win, because the diff can't tell "changed in the
  sender" from "stale in the sender".
- **Pass the id through `bvp:resume`** (the home page → Studio key) instead of the URL, and keep
  it for the home page's Studio link. That key already exists, but it has the problems in Context:
  a key left behind can open the wrong draft later, reloading loses the show, and two handoffs at
  once overwrite each other. A URL fragment has none of these.
- **Await the flush, then open the tab.** This is simpler than going through the backstop, but it
  risks the popup blocker. The backstop is already there, already replays at edit time, and
  replaying a write that did land adds nothing.

## Consequences
- The update-or-add prompt appears only for real files again: Import All, Studio's "Import config
  JSON…", and the Editor's Open…. That was ADR-0011's intent.
- A stale sending tab can no longer revert anything by opening another page. Its own later edits
  still go through the diff, so they only overwrite fields it actually changes.
- **Not fixed here:** a tab left open doesn't see edits made in another tab. It shows an old copy
  until it reloads. That is a display problem (no cross-tab refresh), not a data-loss problem,
  because its edits are per-field diffs. It gets its own ADR if it bites.
- The handoff now depends on the ADR-0028 backstop for the sender's newest edit. If
  `localStorage` is unavailable, the receiving tab can open one burst behind, although nothing is
  lost: the edit still lands in the sender's tab.
- New fragment formats `#show=<id>` on `editor.html` and `studio.html`. Neither page's URL is
  published (only `player.html` URLs are pasted into YouTube cards), so this changes no published
  path. An id that doesn't exist in this browser shows a "draft not found in this browser" notice
  and falls back to the normal boot.
- `bvp:resume` is gone. It is only ever a short-lived handoff key, never draft data, so removing
  it doesn't touch anyone's drafts. A key left over in a browser is just never read again.
- The home page's links become plain `href`s to `#show=<id>`, so middle-click and "open in new
  tab" work too.
- Tests: one e2e test per handoff. Edit in the sender, click the handoff within the 1 s
  burst, and assert the receiver shows the edit, with no new draft and no prompt. A second test
  covers a stale sender tab: open, edit elsewhere, hand off, and assert nothing is reverted.
- **Promotion condition:** if drafts ever sync between devices, a link carrying a show id could be
  opened on a device without that show. The "not found" fallback would then need a real answer,
  in a new ADR.
