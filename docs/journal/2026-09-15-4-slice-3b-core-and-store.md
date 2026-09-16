# 2026-09-15 (4) — Slice 3b, parts 1 and 2: the core, the seam, and two ordering bugs

Slice 3b is the wiring, and I split it again once I saw the size of it: `editor.ts` alone is 984
lines, Studio 654, the home page 294. Rewiring ~1900 lines of page code in one go, against pages
that are live and still only partly browser-verified, is not a change anyone could review. So
**part 1 was the last additive piece, part 2 is the seam the pages will move onto, and part 3 is
the page wiring itself** — still to do.

## Part 1 — collision detection and the diff emitter

`reduce` now returns the ADR-0024 collisions it noticed alongside the shows: a removal that
discarded later edits, carrying the node as it stood before deletion so the UI can offer it back.
It settles when the node is re-added, when a snapshot replaces the show, or when a second
`node-removed` puts the removal after the edits — which is how "leave it deleted" is recorded,
since ADR-0024 says answering is just another event. Only removals that actually discarded
something are reported; a removal that is simply the last word is not a collision.

`core/diff.ts` compares an edited config against the reduced show and emits one event per changed
field. Pages edit a `WorkingShow` — the config plus a positionally-aligned key list — because a
config carries no `nodeKey` and that list is what keeps a **rename a rename** rather than a delete
and an add.

The order assignment took two goes. The first was a left-to-right greedy walk that anchored on the
first node's existing key and renumbered everything behind it, so moving the last node to the
front cost three order events instead of one. It now keeps the longest already-ascending run of
existing keys and regenerates only the rest, which is the fewest any correct assignment can
rewrite.

## Part 2 — the draft store, and the two bugs it found

`shell/draft-store.ts` gives the pages a document-shaped API — `list`, `open`, `save`, `create`,
`remove`, export/import, collisions — over the event log. The first-load migration runs here and
leaves the `bvp:*` keys where they are (ADR-0011), so rolling back the build loses nothing.
`bvp:transfer` and `bvp:resume` stay in `localStorage` on purpose: they are ephemeral page-to-page
plumbing, not drafts, and nothing about them needs to merge or survive.

Writing its tests found two bugs I would not have enjoyed chasing in a browser.

**`toConfig` handed out live references into the reduced state.** Pages edit their config in
place, so the edit mutated the very state it was about to be diffed against — the diff saw no
change and silently saved nothing. The test that caught it was an ordinary "save an edit and get
it back". It copies now.

**Event ordering was decided by coin toss.** ADR-0008 sorts by `(at, id)` and breaks ties by id,
which is random. Timestamps are millisecond-precise and one save writes several events at once, so
I measured a whole create-plus-delete sequence — five events — sharing a single timestamp. Whether
the delete took effect was a coin flip per run.

The store now issues strictly increasing timestamps. That alone wasn't enough: `adopt` also has to
advance the clock past any event set it takes on, because a device that imported a bundle and then
edited it produced an event in the *same millisecond* as the import's, which could sort before the
`node-added` it referred to and be dropped entirely. Both halves are needed, and the second is the
less obvious one.

The cost is the one ADR-0008 already accepts: a device with a badly wrong clock drags everyone's
timestamps forward. That is the right trade — an edit that visibly lands beats one that silently
vanishes — but it is a consequence of *implementing* ADR-0008, not something the ADR anticipated,
and it is worth a look during the next stance review.

Neither bug is a design flaw in the ADRs. Both are the gap between "the model is right" and "the
implementation of the model is right", and both were found by tests that describe what a person
does, not what a function returns.

## Verified

`pnpm lint` clean, `tsc` clean, `pnpm build` green, `pnpm test` **103 passing (was 71)**, docs
hygiene clean (one pre-existing warning). Page hashes are still unchanged, because nothing imports
any of this yet — the app behaves exactly as it did.

## Next: slice 3b part 3, the page wiring

This is where the app's behaviour actually changes, and where Ryan's browser pass stops being
optional.

1. **Home page** (`index.ts`) — list shows from the store; Export All writes an event bundle;
   Import All reads one **and** accepts single-show config files with ADR-0011's update-or-add
   question. This is the feature the whole migration was for.
2. **Studio** (`studio.ts`) — resume list and autosave through the store; "Import config JSON…"
   goes through the same update-or-add path instead of autosaving over a same-titled draft.
3. **Editor** (`editor.ts`) — load and save through the store.
4. **The ADR-0024 notice** — surface `store.collisions()` with its two answers.
5. **Unify the serializers**, which slice 2 deliberately left divergent.

`setResume` currently takes a slug and will need to take a `showId` (ADR-0009). The legacy
`classifyImport` conflict path in `index.ts` goes away with the `bvp-backup` bundle it served.
