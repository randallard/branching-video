# ADR-0016: Generate the SBOM with Syft in CI, not an npm tool
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
cycle-in tried the npm-native CycloneDX generators first; one fails on pnpm's layout and the
other downloads native and Java components and timed out
([cycle-in ADR-0010](https://github.com/randallard/cycle-in/blob/main/docs/adr/0010-sbom-via-syft.md)). The template's `ci.yml` already carries the
fix.

## Decision
`anchore/sbom-action` (Syft) in CI, CycloneDX JSON, uploaded as a build artifact. No SBOM
devDependency.

## Consequences
- The SBOM tool is not part of the dependency tree it describes.
