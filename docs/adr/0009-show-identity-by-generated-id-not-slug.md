# ADR-0009: A show's identity is a generated id, not the slug of its title
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
Drafts are keyed by `slugify(title)`. Two unrelated shows with the same title collide; renaming
a show moves it to a new key; and slugs are where every import conflict in
[ADR-0002](0002-import-conflict-resolution-per-draft-choice.md) comes from. Studio's `saveToLS`
re-derives the slug on every autosave, so importing a config whose title matches an existing
draft silently overwrites it.

## Decision
Each show gets a `showId` generated once, when the show is created (random, injected into the
core by the shell). Title and slug are ordinary, editable fields; the slug is used only for
display and export filenames. Shows migrated from `localStorage` get the deterministic id
`slug:<slug>` ([ADR-0011](0011-legacy-drafts-and-backups-import-as-snapshot-events.md)) so the
same legacy draft migrated on two devices becomes the same show.

## Consequences
- Renaming a show no longer forks it; two shows may share a title.
- A single-show `config.json` carries no `showId` (it is the publish format, ADR-0010), so
  importing one needs a rule for which show it lands on — ADR-0011.
