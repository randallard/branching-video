# 2026-11-01 (3): Renovate triage, Node 26, and the blank-show property

After #47 merged, Renovate closed #43 (TypeScript 7) on its own, so the ADR-1010 rule works. Ryan
asked for the rest of the Renovate queue to be triaged in one PR, with the PROGRESS update folded
in.

## Taken as-is

The Renovate commits were cherry-picked with `-x`, so each one names its source:
- **#39**, checkout v7.0.1 for the `secret-scan` job, the last job still on the older v7 SHA.
  #38 moves it to the same SHA, so it's covered too.
- **#36**, setup-node v7.1.0. The v7.0.0 notes (2026-07-14) list an ESM migration, cache
  outputs, and the removal of a dummy `NODE_AUTH_TOKEN` export. Nothing here publishes, so none of
  it matters.
- **#45**, vitest 5.0.5 (5.0.0 on 2026-09-03, 5.0.5 on 2026-10-15). Its CI was red once and
  green on a re-run. The red wasn't vitest; see below.

## Node 26: ADR-0037

#42 wanted Node 26 for CI and `@types/node`. ADR-1013 (inherited) says Node 24, and its promotion
condition, "move to the next LTS when 24 enters maintenance", has been met: `nodejs/Release`'s
schedule has 24 in maintenance from 2026-10-20 and 26 as Active LTS from 2026-10-28 (26.13.0).
Ryan chose to write an ADR, so per ADR-1000 this repo records the deviation as its own
[ADR-0037](../adr/0037-ci-runs-node-26-lts-ahead-of-the-template.md) instead of touching 1013.
CI moves to 26. The `engines` floor and `@types/node` stay at 24, because the local default Node is
24.16.0 and an engines floor of 26 would fail every local install with
`ERR_PNPM_UNSUPPORTED_ENGINE`, the error that sank Renovate's engines pin in #2. A new Renovate
rule holds `@types/node` at 24.x. The cleaner long-term home is a template ADR superseding 1013.

## The blank-show property: ADR-0038

#45's one red run was `diff.test.ts` › "round-trips any config through a diff", seed
`1023170033`, path `64`. Replaying that seed on `main` under vitest 4.1.12 fails the same way,
with counterexample `{"title":"","startNode":"","nodes":[]}`. That config diffs to no events
against an empty show, so the show never exists. The property was wrong for exactly one input,
and could flake on any run that generated it.

Tracing the callers showed the pages are fine. `DraftSession` stores nothing for a blank working
copy until its first edit, and "New…" starts as "Untitled Show" anyway. Imports write a
snapshot. `DraftStore.create()` is the real defect: it returned an id for a show that wasn't in
the log. Only tests call it.

Ryan chose "a blank show isn't saved" over "always record a new show", which would have meant
changing the event model. [ADR-0038](../adr/0038-a-blank-show-is-not-saved.md) records the choice.
`isBlankShow` in `core/diff.ts` is the single definition, and a property ties it to "diffs to
nothing". `create()` throws on a blank config. The two round-trip properties use `fc.pre` to
exclude the blank case (the second only when both configs are blank), and an example test pins
it. Lint, the cast registry and the build are clean. 159 unit tests passed on five runs and 77
e2e tests passed, locally on Node 24. CI covers 26.

## Next

Merge, then check that Renovate closes #36, #38, #39, #42 and #45. #2 (pin Node 24.22.2) should
be closed if Renovate doesn't rework it. The template should take Node 26 as a new 1NNN ADR.
