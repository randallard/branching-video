# ADR-0023 built: per-field value history in Studio and the Editor

[ADR-0023](../adr/0023-per-field-value-history.md) was the last open piece of slice 4. It's
built, committed as `060f897` on branch `adr-0023-history-and-e2e-suite` together with the
ADR-0027 browser suite (next entry).

## What it is

A field that has held other values gets a small **⟲ n** badge beside its label. Clicking it opens
an inline list of those values, newest first. Each row shows the value, when it was written, and
how: *edited*, *imported*, or *set when the node was added*. That last part is the ADR's "from
which append, where the log can tell". Each row also has a **Use** button, which applies the value
as an ordinary edit through the same persist path. So recovery appends a normal
`*-field-set` with a current timestamp, and the value it displaces joins the same history, exactly
as the ADR says.

Covered: in the Editor, every show setting and every node field (id, title, video id,
start/end/show-choices-at, the three checkboxes, return-to, choices, end screen). In Studio, the
fields Studio actually edits: node id, title, start, end, return-to, choices. Restoring an old
node **id** goes through each page's existing rename, so references (choices, return-to, start
node, and in the Editor end-screen links) follow it.

## How it's derived

`reduce` takes an optional recorder and reports every field value it actually *applies*, in fold
order. `core/history.ts` builds the per-field lists from that. I chose this over writing a second
fold in `history.ts` because a second fold would be a second copy of the reducer's rules: which
write wins, and that an edit to a removed node is discarded (ADR-0024), not applied. Observing the
one fold means the history can't disagree with the reducer. A property test checks it anyway:
every field's last history entry equals what `reduce` holds, over arbitrary event sets. It also
checks that the history is a function of the event *set* (permutation- and duplicate-invariant),
like the reducer.

`DraftStore.priorValues(ref)` builds the histories lazily on first ask and drops them on every
adopt, so a page load that never opens a history pays nothing.

## Two decisions below ADR size

- **Empty values are never offered.** Getting "nothing" back is just clearing the field, which
  needs no history. Listing it would also have put a badge on nearly every field: a node is added
  with `title: ""`, then someone types a title, and "(empty)" becomes a prior value. So `""`,
  `null`/absent, `false` and `[]` are filtered out of the offered list, though they stay in the
  underlying history.
- **Each value is listed once**, at the last time it was written, and the current value is left
  out. The ADR asks "what else has this been", which is set-shaped, not a changelog. The
  per-show changelog was the alternative the ADR rejected.

## The Editor was writing an event per keystroke

This came out of building the history, not the tests. The Editor's text and number inputs
persisted on every `input` event, so typing "Welcome" wrote seven `node-field-set` events. That
already violated [ADR-0007](../adr/0007-indexeddb-append-only-event-log-storage.md)'s
consequence: *"edit events must be coalesced (e.g. one event per field per edit burst) rather than
emitted per keystroke"*. Slice 3b.3's draft-first autosave introduced it, and nothing noticed
because the reducer doesn't care. A per-field history does care: the title's history would have
been every prefix typed.

Fix: `DraftSession.persistSoon(config)` writes once typing pauses for `EDIT_BURST_MS` (1000 ms).
Any immediate `persist`, `flush`, `attach` or `reset` writes a pending burst first, and the
Editor flushes on `visibilitychange` → hidden and on `pagehide`. The Editor's typed inputs
(titles, ids-by-text, numbers, choice/link labels, URL, end-screen heading/body) use
`persistSoon`. Checkboxes, selects and buttons still write immediately. Studio needed nothing: its
inputs already fire on `change` (blur/enter), which is one burst by construction.

**A latent race fixed on the way.** `DraftSession`'s queued save read `this.showId` when it
*ran*, not when it was *queued*. So a save still queued when the person switched drafts (My
Drafts, New…, an import) would land on the newly opened show. With per-keystroke saves the window
was a few ms. A 1 s debounce would have made it real. Each save now carries the slot
(`showId` + `nodeKeys`) it was queued against, and a test covers "edit, switch drafts before the
pause, the edit still lands on the first show".

Existing per-keystroke events already in anyone's log are not rewritten (the log is
append-only). They'd only show up as extra prior values on fields edited in the Editor between
3b.3 (2026-09-18) and now, which in practice is Ryan's own testing.

## Verified

- `pnpm test` 113 → 125 (9 in `history.test.ts`, 3 new in `draft-session.test.ts`); `pnpm lint`,
  `tsc`, `pnpm build` clean.
- Throwaway CDP smoke test (scratchpad, not committed; same practice as before) against
  `vite preview` on port 4299, so Ryan's dev server on 8080 wasn't touched. 19/20 passed: a fresh
  import shows no badge; a four-keystroke burst yields exactly one prior value; the list is newest
  first with correct *edited*/*imported* labels; Use restores into the form and the node list, and
  the displaced value joins the history; show-level title, checkbox and number fields all get
  history; renaming a node id and restoring it cascades the start node both ways; history
  survives a reload (IndexedDB) and shows the same in Studio, where Use also restores. The one
  failure was the known `favicon.ico` 404 (already on the backlog). No other console errors, no
  CSP violations.

**Not verified:** real-device two-browser merge (phone edit → laptop edit → import bundle → see
the phone's value in the list). The unit test covers the log-level case (`"keeps the losing side
of a two-device edit recoverable"`), but nobody has done it by hand. The mobile drawer layout of
the badges also hasn't been looked at on an actual phone.
