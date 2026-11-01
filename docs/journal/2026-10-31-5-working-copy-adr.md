# 2026-10-31 (5) — ADR-0034: the Editor/Studio working copy, recorded

Branch `adr-working-copy`. The first of the three follow-ups Ryan took from the stance review
(order: this ADR, then pnpm 12, then the player reducer).

## What was recorded

[ADR-0034](../adr/0034-editor-and-studio-edit-a-working-copy-diffed-into-events.md): the Editor
and Studio hold a whole `ShowConfig` (a `WorkingShow`) and mutate it; `DraftSession.persist` /
`persistSoon` diff it against the stored state through `src/core/diff.ts`, one event per changed
field. The log stays the only stored fact. This is the project's recorded deviation from
ADR-1017's "never copied" (per ADR-1000), recorded rather than refactored, at Ryan's call.

The reasons came from the code, not invented for the ADR: `diff.ts`'s header and slice 3b say
per-field events are what make cross-device merges work (ADR-0008), and the diff is the
coalescing ADR-0007 asks for. The unload backstop (ADR-0028) is named as the same rule's second
temporary copy.

## Checked before writing it down

- Every link resolves, including `../reviews/2026-10-31-stance-review.md`; ADR-0029 is now linked.
- `src/core/diff.test.ts` exists and is property-tested with fast-check, as the ADR says.
- A draft said "29 assignments in the Editor alone". A count of direct `config` mutations didn't
  reproduce it (mutations also go through node objects, so any regex count is a guess), so the
  number came out.

## Next

1. Ryan verifies, then commit and PR this branch.
2. pnpm 12 (trialled viable in the stance review); ADR first. Watch ADR-1018: pnpm 12's
   two-document lockfile needs osv-scanner reading the whole file (this repo is on OSV v2.7.0).
3. The player reducer: ADR, then the change.
