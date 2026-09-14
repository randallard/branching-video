# ADR-0013: Exact dependency versions, one registry, frozen lockfile
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
A version range means the dependency reviewed today is not necessarily the one installed
tomorrow; `package.json` currently has `"serve": "^14.2.4"`. An unrestricted registry lets a
lookup resolve somewhere unchosen. Adopted from
[cycle-in ADR-0007](https://github.com/randallard/cycle-in/blob/main/docs/adr/0007-pin-exact-versions-restrict-registry.md).

## Decision
- No `^`/`~` ranges in `package.json`; exact versions only.
- `.npmrc`: `registry=https://registry.npmjs.org/`.
- `pnpm-lock.yaml` committed; CI installs with `--frozen-lockfile`.

## Consequences
- What was reviewed is what installs, locally and in CI.
- Updates are deliberate diffs, admitted through Renovate under
  [ADR-0014](0014-age-gate-dependency-admission.md).
