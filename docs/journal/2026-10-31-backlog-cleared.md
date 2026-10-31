# 2026-10-31 — the PR backlog is cleared, and the merge order that held it up

Documents `c0c89dd`, `15e1dcd` (both on #20, merged as `dc7755c`), `bb267f7` (#21's merge of
`main`, merged as `c3298f5`) and `74e4c2f`.

## Why nothing could merge

Since 10-14 every open PR had been red, and they had to land in order: #20 (the advisory fix)
first, because every other branch was cut from a `main` that carried the advisories; #21 next;
then Renovate. #20 itself was red for a reason that wasn't visible from its PR page:
**`c0c89dd`, the commit that actually carried the override and the one-day gate, was never
pushed.** Its message says it was "missed from 8e7d774"; it sat one commit ahead of
`origin/fix-advisories-2026-10` for 16 days, so CI kept testing the ADR-only version and OSV
kept flagging `http-cache-semantics` 4.2.0. Pushing it cleared that one.

## Eleven more advisories in sixteen days

The push exposed what had landed meanwhile, all in dev tooling, none in `dist/`:

- **Direct bumps:** `vite` 8.0.16 → 8.1.6 (also clears `launch-editor`), `vitest` 4.1.11 →
  4.1.12 (`@vitest/mocker` GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp).
- **Override floors raised:** `undici@6` → ^6.29.1 (four GHSAs), `ip-address` → ^10.7.4
  (GHSA-rxp7-6hxx-x8q5).
- **glob** (GHSA-3g3m-2fjr-6pw4) and **minimatch** (GHSA-g3hv-75wg-m249): fixed only in new
  majors, both released 2026-10-27, no backport.

The last two broke the "an override stays in its major" rule in `pnpm-workspace.yaml`. Ryan
asked what `the-lot` and `square-one` had done; their rule is *override where an override works,
ignore (in both scanners, ADR-0030) only where none does*, the brace-expansion history being the
case where a cross-major override broke `pnpm lint`. So the cross-major override was measured
here before anything was decided: lint, 135 tests, build, `pnpm audit`, signatures, the licence
allowlist and the OSV container all passed, then CI including e2e. Hence `glob@13` →
`>=14.0.2 <15` and `minimatch@10` → `>=11.0.1 <12`, upper-bounded, with the reasoning and the
fallback (a two-scanner ignore) in the comment.

Once synced, both sibling repos turned out to have answered the same two advisories on 10-30
(`the-lot` `cd0c008`, `square-one` `ddd1f22`): the same glob override, but an **ignore** for
minimatch. That isn't a disagreement. Their lockfiles also carry **minimatch 3.x** (via eslint
and typescript-eslint), which can't be forced to 11 without breaking eslint, so no override
reaches every copy. This repo has no minimatch 3 — only 10, which the override moves — so the
same rule lands on an override here.

## The merges

- **#20** green after `15e1dcd`, merged (`dc7755c`), as a merge commit like #17/#18.
- **#21** was rebased first, then reset: the rebase rewrote commits already on GitHub, which
  would have needed a force-push. `main` was merged into the branch instead (`bb267f7`); git's
  recorded resolutions replayed the two trivial conflicts (PROGRESS's "Last updated" date; the
  ADR index, where 0029 and 0030 both belong). 138 unit tests, CI green. Its own PROGRESS still
  said "waiting on Ryan's local check"; Ryan confirmed he'd done it, and it merged as `c3298f5`.
- **Renovate**, by a polling script that merged whatever was `CLEAN` and ticked the rebase box
  on anything `BEHIND`: #8, #9, #10, #11, #15, and #23 (opened mid-run).

## What the rest were stuck on (`74e4c2f`)

- **#16** (typescript-eslint 8.72.1) newly flags `build.rollupOptions` as deprecated: vite 8
  builds with rolldown. Renamed to `rolldownOptions`; lint is clean against 8.72.1 installed
  locally, and the build still emits all five pages.
- **#2** ("pin dependencies") would have pinned every override range to one version and the
  `engines` floors to Node v26 / pnpm 12 — the latter is its `ERR_PNPM_UNSUPPORTED_ENGINE`.
  ADR-0013's `rangeStrategy: "pin"` is about dependencies; overrides are deliberate ranges whose
  installs the lockfile already fixes, and engines are a support floor. A `packageRules` entry
  disables Renovate for those two dep types. `renovate-config-validator` passes.
- **#6, #7** wait only on `renovate/stability-days`, the one-day gate. Nothing to do.

## Also landed here

The 2026-10-20 `work/typescript-review` items (T2 oxlint/tsgolint trial, T3 the opt-in extras,
T4 Node 22 → 24) had been sitting as an uncommitted PROGRESS edit on #20's branch; stashed
before #20's push and committed with this entry instead, under the Worklist.

## Next

Merge #16 once Renovate rebases it onto this; check that #2 re-plans down to the CI
`node-version` pin (`22` → `22.23.4`) before merging; #6/#7 when the gate clears. Then the five
manual checks and the tooling trial.
