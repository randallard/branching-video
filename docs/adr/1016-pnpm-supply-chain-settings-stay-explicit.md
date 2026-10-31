# ADR-1016: pnpm supply-chain settings stay explicit, and major pnpm bumps are evaluated first
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
pnpm 11 (2026-04-28) made our posture its default: `minimumReleaseAge: 1440`,
`blockExoticSubdeps`, and policy-aware `dlx`. pnpm 12 has since shipped, with changed git
dependency resolution among other things. Defaults change between majors.

## Decision
`minimumReleaseAge`, `trustPolicy: no-downgrade`, `blockExoticSubdeps` and the build allowlist
are set **explicitly** in `pnpm-workspace.yaml`, whatever the defaults. A new pnpm **major** is
evaluated in a stance review before `packageManager` moves.

## Consequences
- Some settings duplicate pnpm's defaults. That's intended, so a default change can't silently
  weaken them.
