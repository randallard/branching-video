# ADR-0017: Enforce a dependency licence allowlist in CI
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
The project is meant to be forked ("Make your own" in `create.html`) and is being licensed
permissively ([ADR-0019](0019-dual-mit-apache-license.md)). An incompatible licence deep in the
tree is cheap to catch at the PR that adds it and expensive to find later. Adopted from
[cycle-in ADR-0011](https://github.com/randallard/cycle-in/blob/main/docs/adr/0011-license-allowlist.md).

## Decision
`license-checker-rseidelsohn --excludePrivatePackages` in CI with the template's allowlist:
`MIT` · `Apache-2.0` · `BSD-2-Clause` · `BSD-3-Clause` · `ISC` · `0BSD` · `CC0-1.0` ·
`Python-2.0` · `BlueOak-1.0.0` · `MPL-2.0` · `CC-BY-3.0`. A new entry is added only after
`pnpm why` shows what pulled it in.

## Consequences
- Only declared licences are checked; a misdeclared package is not caught.
