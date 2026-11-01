# ADR-0038: A blank show is not saved, and creating one is refused
- Status: Accepted
- Date: 2026-11-01
- Deciders: Ryan

## Context
A show exists in the log only once an event names it ([ADR-0008](0008-edit-level-events-per-field-last-writer-wins.md)).
A save is a diff against what the log already holds, and a show the log has never seen diffs
against `emptyShowState` ([ADR-0034](0034-editor-and-studio-edit-a-working-copy-diffed-into-events.md)).
So a config with no title, no start node, no master video, no choice display time and no nodes
(`{ title: "", startNode: "", nodes: [] }`) diffs to **no events**, and the show never exists.

Renovate #45 (vitest 5) turned this up. `diff.test.ts`'s property "round-trips any config
through a diff" failed on CI on that config. The same seed (`1023170033`, path `64`) fails on
`main` under vitest 4, so the property has been able to flake since it was written. The
property says every config comes back, and for the blank config it doesn't.

That has two consequences:
- **The pages are unaffected.** `DraftSession` gives a new show an id and saves only what has
  changed, so a blank working copy stores nothing until its first edit, and that edit creates the
  show under the same id. That's the behaviour we want: opening a blank show and walking away
  leaves nothing behind. The Editor's "New…" starts from `title: "Untitled Show"` and
  `choiceDisplaySeconds: 8` anyway, so it never saves a blank show. Imports write a
  `show-snapshot` event, which always names the show.
- **`DraftStore.create()` is wrong for a blank config.** It returns a fresh id for a show that
  isn't in the log, so `open(id)` and `config(id)` return nothing for an id the caller was just
  given. Only tests call `create()` today.

## Decision
- **A blank show isn't saved.** Blank means the config diffs to nothing against an empty show,
  and `isBlankShow` in `core/diff.ts` is the one definition.
- **`DraftStore.create()` refuses a blank config** by throwing, rather than returning the id of
  a show that doesn't exist.
- The round-trip property excludes the blank config (`fc.pre`), and an example test pins that a
  blank config saves no events.

## Alternatives considered
- **Always record a new show**, for example by emitting the title even when it's blank. Then
  every config round-trips, but every blank working copy that's opened and abandoned leaves a
  show in the log. It would also need a new kind of event, or a rule that `show-field-set` can
  carry a value equal to the empty one, which is a change to ADR-0008's event model with nothing
  to gain.
- **Pin the property's seed.** That hides the case instead of deciding it.

## Consequences
- The property suite is deterministic in substance again: the one input that failed is now a
  stated rule with its own test, not a random flake.
- A future caller that needs a show to exist before anything is typed must give it a title, or
  raise this ADR again.
