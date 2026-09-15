# Dev journal

A dated, narrative worklog — the *story over time* that the other docs don't capture:
commit messages are per-commit, [`../adr/`](../adr/README.md) is per-decision, a changelog
would be per-release. This is the running "what we did and why, in order."

## Convention

- One file per entry: `YYYY-MM-DD-kebab-title.md`. Multiple entries in a day get a `-1`, `-2`
  suffix.
- Each entry names the **commit(s) it documents** by short hash, once one exists.
- Entries are **append-only**: correct a mistake in a later entry, don't rewrite an old one.
  Same reasoning as ADR immutability — the record of what you believed at the time is the
  valuable part.

## Journaling with commit hashes (the self-reference rule)

A commit **cannot contain its own hash** (the hash is derived from the content). So a journal
entry references the **work commit it documents**, and is itself landed in a **follow-up
commit**:

```
commit A  ── the work
commit B  ── "journal: document commit A"   (entry references A's hash)
```

This keeps referenced hashes real and stable, with no history rewriting. (Alternative for pure
annotation without a file: `git notes add <commit>`.)

## What's worth an entry

Not every commit. Write one when there's reasoning a future reader would otherwise have to
reconstruct:

- A session where something surprised you, or the first approach was wrong.
- Anything discovered by *running* the thing that the tests didn't catch — those are the
  entries you'll reread.
- A decision that isn't big enough for an ADR but that you'd otherwise forget the reason for.
- The narrative around an ADR: the ADR says what was decided, the journal says how you got
  there.

Terse and first-person is fine. This is a lab notebook, not a report.

## Entries

| Date | Summary |
|---|---|
| [2026-07-08 (1)](2026-07-08-1-bulk-export-import.md) | Export All / Import All for local drafts ([e97075d](https://github.com/randallard/branching-video/commit/e97075d)) — filename renamed 2026-09-14 to the template convention |
| [2026-07-08 (2)](2026-07-08-2-import-merge-conflicts.md) | Import merge conflict resolution (keep mine/backup/both) — committed as [3bb7fd8](https://github.com/randallard/branching-video/commit/3bb7fd8) |
| [2026-09-14 (1)](2026-09-14-1-adopt-the-template.md) | Adopting the cr-ci-cd template: the audit, the three choices, slice 1 (conventions, CI, ADRs 0003–0019) |
| [2026-09-14 (2)](2026-09-14-2-slice-2-typescript-port.md) | Slice 1 committed (981add8); slice 2 Vite + strict TS port, gates biting, ADR-0020/0021 proposed |
