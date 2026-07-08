# ADR-0002: Import conflict resolution — per-draft keep-mine/keep-theirs/keep-both, only when content actually differs
- Status: Accepted
- Date: 2026-07-08
- Deciders: Ryan

## Context
[ADR-0001](0001-bulk-backup-single-json-bundle-merge-by-slug.md) shipped "Import All" as a
blind merge-by-slug: any incoming draft with a slug already present on the machine silently
overwrote it. That's fine for a clean backup/restore of one machine, but breaks the moment two
machines have both been used independently — e.g. drafts worked on in the phone browser,
exported and emailed to a laptop that also has its own local drafts (some under the same
slugs, edited differently on each side). Importing that backup as-is would silently discard
whichever side wasn't in the file, with the specific concern being raised: "I don't want to
lose those [the laptop-only edits]."

## Decision
On import, classify every incoming draft against what's already in `bvp:index` /
`bvp:config:<slug>`:

- **Only in the backup** → added automatically, no prompt.
- **Same slug, byte-identical config** (`JSON.stringify` equal) → left alone, no prompt, no-op.
- **Same slug, different config** → held back as a conflict and shown in a review modal, one
  row per conflicting draft, with both sides' "modified" timestamps and a per-item choice:
  - **Keep both** (default) — adds the backup's version under a new slug
    (`<slug>-imported`, `<slug>-imported-2`, ... on further collision) so neither version is
    lost.
  - **Keep mine** — ignore the backup's version.
  - **Keep backup** — overwrite the local version (the old ADR-0001 behavior, now opt-in per
    item instead of automatic for everything).

Only real conflicts interrupt the flow; if there are none, import applies immediately with a
one-line summary, same as before.

## Alternatives considered
- **Keep the blind overwrite (status quo)** — rejected; directly fails the stated goal of not
  losing independently-edited local drafts when importing a backup from another device.
- **Always prompt on any same-slug match**, even when content is identical — rejected; adds a
  pointless decision every time the same backup is re-imported unchanged (e.g. re-importing
  after confirming a transfer worked).
- **Default the per-conflict choice to "keep backup" or "keep mine"** — rejected in favor of
  defaulting to **keep both**: whichever default is wrong, it silently drops one side's edits;
  "keep both" is the only default that can't lose data, at the cost of leaving a
  `-imported` copy to clean up by hand.

## Consequences
- Multi-device use (phone → email → laptop, or vice versa) no longer risks silently dropping
  whichever side isn't in the imported file.
- Conflicts default to keeping both copies rather than resolving automatically, which means a
  multi-device workflow will accumulate `-imported` / `-imported-2` drafts over time if the
  same slug keeps diverging — expected to be cleaned up manually (delete the stale copy in
  Studio) rather than automated, since this is a rare, deliberate action rather than routine.
- Equality check is `JSON.stringify` comparison, not a semantic diff — reordered-but-equivalent
  JSON would currently register as a false conflict. Not addressed; not expected to happen in
  practice since configs are always produced by this app's own serialization.
