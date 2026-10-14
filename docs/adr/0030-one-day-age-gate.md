# ADR-0030: The age gate is one day, not fourteen
- Status: Accepted
- Date: 2026-10-14
- Deciders: Ryan

## Context
Supersedes [ADR-0014](0014-age-gate-dependency-admission.md), which gated new releases for 14
days at both `pnpm-workspace.yaml` and `renovate.json`. The *layering* in that ADR still holds
(the package manager gate and the bot gate cover different paths); the *number* stopped holding.

The 14 came from cycle-in's 2026-07-18 stance review, before the two projects that looked at it
properly did. `the-lot` and `square-one` both run `minimumReleaseAge: 1440` (1 day), which is
pnpm's own documented recommendation and its v11 default: "in most cases, malicious releases are
discovered and removed from the registry within an hour." `the-lot` also found that a timed ignore
written to "wait out" a quarantine was wrong: the real gate was one day and the fix had already
cleared it, so nothing was being waited for.

Fourteen days has had a concrete cost here: on 2026-10-14 every open Renovate PR was red from
advisories on `main` itself, and the one with no usable fix, `http-cache-semantics` 4.3.0
(published 2026-10-04), was blocked only by the gate. cycle-in carried a seven-entry dated ignore
list for the same reason.

## Decision
Gate new releases for one day at both layers, still matched:

- `pnpm-workspace.yaml`: `minimumReleaseAge: 1440` (minutes).
- `renovate.json`: `minimumReleaseAge: "1 day"`.

`trustPolicy: no-downgrade` and `blockExoticSubdeps: true` are unchanged.

## Alternatives considered
- **Keep 14 days and quarantine advisories with dated ignores.** What we were doing. Each ignore
  has to be written twice (once per scanner), remembered, and removed; it buys a delay against a
  risk pnpm's evidence says is mostly gone within an hour.
- **Something in between (3 or 7 days).** `square-one` started at 7 days and moved off it.
  Without a reason to believe the evidence differs, a number between the two is false precision.

## Consequences
- A freshly published release can be adopted after a day, so there is a window where a
  compromise that takes longer than a day to be noticed gets through. The advisory scanners
  (ADR-0015) and `trustPolicy: no-downgrade` remain the other layers.
- Dated advisory ignores for the sake of the gate are no longer expected. A legitimate ignore
  (no patched version exists at all) still goes in both scanners.
- `minimumReleaseAgeExclude` still exists for an emergency and should cite why.
- Revisit if a package compromise slips through a one-day window.
