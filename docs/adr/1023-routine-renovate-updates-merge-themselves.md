# ADR-1023: Routine Renovate updates merge themselves once CI passes; majors stay manual
- Status: Accepted
- Date: 2026-11-21
- Deciders: Ryan

## Context
[ADR-1021](1021-projects-start-with-a-renovate-config.md) ships a `renovate.json` that opens a PR
for every update, and nothing merges them except a person. Three weeks after the app was
installed, cycle-in had 16 open Renovate PRs and branching-video 10. Clearing them on 2026-11-21
took most of an afternoon, and nearly all of that time was waiting:

- branching-video requires PRs to be up to date with `main`, so each merge sent the rest back for
  a rebase and a full CI run, one PR at a time.
- Several GitHub-actions PRs touch the same workflow lines, so only one could merge per Renovate
  rebase.
- 21 of the 23 merged PRs were patch, minor, digest or pin updates, and none of them needed a
  decision. Their CI passed and they were merged. Only vitest 5 and setup-node v7 were majors.

The repos already have what automerging needs. CI runs the unit and e2e tests, the type-aware
lint, the supply-chain checks, the SBOM and the OSV scan. Updates wait out the one-day age gate
(`minimumReleaseAge`, ADR-1007, ADR-1016). The rules from ADR-1010 and ADR-1022 hold back the
updates that would break a standard. The only missing piece is the setting that lets a green PR
merge itself.

One precondition is not in place everywhere. If a repo has no required status checks, Renovate
treats a PR with no reported checks as passing, so it can merge before CI has started.
branching-video's `main` requires seven checks. cycle-in's `main` has no branch protection at all
(checked 2026-11-21).

## Decision
- **`renovate.json` automerges routine updates**: `minor` and `patch` updates of packages at
  1.0 or later, and every `digest`, `pin`, `pinDigest` and `lockFileMaintenance` update. Each one
  merges only after every check passes and the age gate has cleared, the same bar a person
  applies.
- **Majors, and minors of 0.x packages, stay manual.** Under semver a 0.x minor can break things,
  so it gets the same review as a major. The rules that hold packages back (ADR-1010, ADR-1021,
  ADR-1022) are unchanged, so automerge never sees a version those rules block.
- **Automerge is enabled only in a repo whose `main` requires the CI checks.** Branch protection
  (or a ruleset) on `main` must list the CI jobs as required status checks before the project's
  `renovate.json` takes this rule. That way "passing" means CI actually ran.
- **Renovate does the merging, and the merge strategy is left to the repo.** `automergeType`
  stays `pr` and `platformAutomerge` stays at its default. If the repo allows GitHub auto-merge,
  a PR merges as soon as its checks pass. If not, Renovate merges it on its next run. The default
  `rebaseWhen: "auto"` rebases PRs that have fallen behind `main`, which is what clears a
  required-up-to-date queue without anyone stepping in.
- **The template's GitHub mirror is unchanged**: Renovate still isn't installed there
  (ADR-1021), so this rule takes effect only downstream.

## Alternatives considered
- **Keep merging by hand.** It costs a few minutes a week if done weekly. It cost an afternoon
  after three weeks, and the backlog is also how security patches end up sitting unmerged.
- **Group all non-major updates into one weekly PR.** That's fewer PRs, but one red package then
  holds back every other update in the group, and finding which one failed takes a person. With
  automerge, separate PRs cost nothing to merge, and a red one fails on its own. A project can
  still add a schedule or a group if the PR noise bothers it.
- **Automerge majors too, or merge without opening a PR (`automergeType: "branch"`).** A major is
  where a person needs to read the changelog: vitest 5 and setup-node v7 each needed a check
  against ADRs this month. Branch automerge also leaves no PR to review or revert from.

## Consequences
- **Adopting it:** copy this ADR and the automerge rule into the project's `renovate.json`.
  First make sure `main` requires the CI checks, and add branch protection where it's missing
  (cycle-in). If you want PRs to merge as soon as checks pass instead of on Renovate's next run,
  turn on the repo's "Allow auto-merge" setting.
- Renovate's Dependency Dashboard and PRs that fail CI still need a person. Automerge only
  removes the green, routine merges.
- An automerged update that breaks something CI doesn't cover reaches `main` without anyone
  reading it. Reverting its merge commit is the fix, and the gap should become a test.
- Promotion condition: if an automerged update ever breaks `main` or a deployed site, write an
  ADR that narrows the rule (for example, devDependencies only) or adds the missing check.
