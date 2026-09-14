# ADR-0012: Block install-time script execution
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
Install-time scripts are the dominant execution vector for npm-ecosystem malware: a compromised
package runs arbitrary code the moment it is installed, before anything imports it. Until now
this repo had one devDependency (`serve`) and no controls; the migration to Vite, TypeScript,
ESLint and Vitest ([ADR-0005](0005-vite-multi-page-build-replaces-no-build-html.md)) brings in a
few hundred transitive packages. Adopted from
[cycle-in ADR-0006](https://github.com/randallard/cycle-in/blob/main/docs/adr/0006-block-install-time-scripts.md) per
[ADR-0003](0003-retrofit-cr-ci-cd-template-onto-existing-repo.md).

## Decision
- `.npmrc`: `ignore-scripts=true`.
- pnpm's native-build gate configured in `pnpm-workspace.yaml` (not `package.json`'s `pnpm`
  field, which pnpm 11 no longer reads), starting with no allowed builds.
- Any exception is added individually to `allowBuilds` with the reason it was reviewed. Never
  blanket-approved.

## Consequences
- A dependency that genuinely needs a build step fails loudly at install and gets a deliberate
  review. None of the planned toolchain does (cycle-in runs the same set with none allowed).
