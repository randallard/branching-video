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
| [2026-09-15](2026-09-15-deploy-instructions-catch-up.md) | README + `create.html` deploy instructions catch up with the Actions cutover; the stale "no build step" copy reworded |
| [2026-09-15 (2)](2026-09-15-2-browser-pass-last-node-wrap.md) | Browser pass: ADR-0022 play-through confirmed; last node wraps at 806.5s of an 1190s video — Ryan kept the behaviour, documented the authoring rule |
| [2026-09-15 (3)](2026-09-15-3-slice-3a-event-log-core.md) | Slice 3a: event-log core, reducer, bundle, migration and IndexedDB store — additive, 30 → 71 tests |
| [2026-09-15 (4)](2026-09-15-4-slice-3b-core-and-store.md) | Slice 3b parts 1–2: collision detection, diff emitter, draft store — and two ordering bugs (aliased state, coin-toss event order) |
| [2026-09-17](2026-09-17-supply-chain-audit.md) | Supply-chain audit: all 8 ADRs verified, SBOM subject/floor + `osv-scan` deploy gate fixed; ADR-0026 (CSP) proposed; branch protection and Renovate installation flagged as unresolved |
| [2026-09-18](2026-09-18-branch-protection-and-renovate-check.md) | Branch protection on `main` set via `gh api` (PR required, status checks, no admin enforcement); Renovate confirmed not installed (Ryan checked github.com/settings/installations) |
| [2026-09-18 (2)](2026-09-18-2-csp-accepted-and-shipped.md) | ADR-0026 accepted; CSP meta tag added to all five pages, verified with a headless-Chromium pass including a real YouTube IFrame API load — zero violations |
| [2026-09-18 (3)](2026-09-18-3-slice-3b3-page-wiring.md) | Slice 3b.3: home page, Studio, Editor wired onto the event-log DraftStore — the import-overwrite bug fixed by construction, Editor goes draft-first, `dirty`-on-load bug retired by elimination |
| [2026-09-19](2026-09-19-adr-0023-per-field-history.md) | ADR-0023 built: ⟲ per-field history + Use in Studio and the Editor, derived from the reducer's own fold; Editor's per-keystroke events coalesced (ADR-0007) and a draft-switch save race fixed ([060f897](https://github.com/randallard/branching-video/commit/060f897)) |
| [2026-09-19 (2)](2026-09-19-2-playwright-suite.md) | ADR-0027: committed Playwright suite (60 tests, hermetic fake YouTube, two-device merges) — and three real bugs it found on day one ([060f897](https://github.com/randallard/branching-video/commit/060f897)) |
| [2026-09-19 (3)](2026-09-19-3-first-e2e-flake.md) | First e2e flake (on Renovate #15): tests navigating away mid-IndexedDB-write; `reopenUntil` waits in-page instead. Also closes a real 1 s leave-the-page window from the edit-burst debounce: the Editor flushes on `focusout` ([a1d7de4](https://github.com/randallard/branching-video/commit/a1d7de4)) |
| [2026-09-19 (4)](2026-09-19-4-unload-backstop.md) | ADR-0028 unload backstop: unsaved edits parked in localStorage on hide/unload, replayed at edit time so a stale copy can't revert later edits; ids fixed at edit time; a failed save no longer wedges the queue |
