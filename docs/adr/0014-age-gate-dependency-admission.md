# ADR-0014: Age-gate new dependency releases at the package manager and the update bot
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
Advisory scanners ([ADR-0015](0015-ci-vulnerability-scanning.md)) only know about a malicious
version once it is disclosed, and most npm compromises are caught within hours to days of
publication. Waiting covers that window. An age gate that lives only in `renovate.json` paces
Renovate's pull requests and does nothing for a manual `pnpm add` — cycle-in learned this in its
2026-07-18 stance review ([cycle-in ADR-0008](https://github.com/randallard/cycle-in/blob/main/docs/adr/0008-age-gate-dependency-admission.md)).

## Decision
Gate at both layers, matched at 14 days:

- `pnpm-workspace.yaml`: `minimumReleaseAge: 20160` (minutes), plus `trustPolicy: no-downgrade`
  and `blockExoticSubdeps: true`.
- `renovate.json`: `minimumReleaseAge: "14 days"`.

`packageManager` pins pnpm 11, where all three settings exist.

## Consequences
- A new release cannot be adopted for two weeks; `minimumReleaseAgeExclude` exists for a
  genuine emergency and should cite why.
- The pnpm and Renovate settings look redundant and are not; they gate different paths and are
  changed together.
