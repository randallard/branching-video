# ADR-0011: Existing drafts, old backups and single-show files enter the log as snapshot events
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
Three kinds of existing data must keep loading after
[ADR-0007](0007-indexeddb-append-only-event-log-storage.md):

1. Drafts in each browser's `localStorage` (`bvp:index`, `bvp:config:<slug>`).
2. `bvp-backup` bundles from the current Export All ([ADR-0001](0001-bulk-backup-single-json-bundle-merge-by-slug.md)).
3. Single-show config files ([ADR-0010](0010-config-json-stays-the-publish-and-interchange-format.md))
   — the case that started the migration: a downloaded
   `most-useful-music-theory-for-ukulele 3.json`, rejected today by Import All and
   silently overwrite-prone in Studio's import. Browsers suffix repeat downloads, so several
   versions of one show often sit side by side.

## Decision
Each becomes a `show-snapshot` event. The event's `id` is a stable hash of
`(showId, canonical config JSON)`, computed in the core, so **importing the same content twice
is a no-op** on any device. Its `at` is the draft's recorded `modified` time where one exists,
else the import time.

- **`localStorage` drafts** migrate once, automatically, on first load of the new build:
  `showId = slug:<slug>`. The `bvp:*` keys are left in place, not deleted, so rolling back the
  build loses nothing.
- **`bvp-backup` bundles** import through Import All the same way (`slug:<slug>`), so a
  backup's drafts and the same browser's migrated drafts land on the same shows.
- **Single-show config files** are accepted by Import All (one or several files at once). Each
  file whose title matches an existing show asks once, per file: **update that show** (a
  snapshot on its `showId`) or **add as a new show** (new `showId`). A file matching no show is
  added without asking. Studio's "Import config JSON…" goes through the same path instead of
  autosaving over a same-titled draft.

## Alternatives considered
- **Auto-match single-show files by title with no prompt** — rejected: titles are not
  identity (ADR-0009), and "ukulele" versions 1–3 imported in the wrong order would silently
  roll a show back.
- **Always add single-show files as new shows** — rejected: re-importing an edited export of
  an existing show is the common case, and it would pile up copies — the `-imported` clutter
  ADR-0002 already produces.

## Consequences
- The update-or-add question is the one import prompt left; it exists only because a config
  file has no identity, and never appears for event bundles.
- A snapshot import of an older file onto a show is a normal "last writer" edit, visible and
  reversible by importing the newer file or editing again.
