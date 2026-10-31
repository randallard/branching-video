# ADR-1018: OSV-Scanner is at least v2.7.0, and a scan is read by its package count, not just its verdict
- Status: Accepted
- Date: 2026-10-31
- Deciders: Ryan

## Context
pnpm 12 writes `pnpm-lock.yaml` as **two YAML documents**: the package manager's own entries
(`packageManagerDependencies`: pnpm and its platform binaries), then the project's. OSV-Scanner
v2.3.8, which `ci.yml` pinned, reads only the first document. On a downstream repo that moved to
pnpm 12 it reported "found 16 packages" (pnpm's own) where the real count was 307, and then "No
issues found". The `osv-scan` job would have stayed green indefinitely while scanning none of the
project's dependencies. v2.7.0 reads both documents (307).

The failure is silent by construction: the job passes, and the verdict line is the same as a
real clean scan's. Only the package count shows it. The same downstream repo caught it only
because someone read that line.

Nothing here depends on pnpm 12 being adopted yet: a project on pnpm 11 scans correctly with
v2.3.8, and stops scanning correctly the day it moves.

## Decision
- `ci.yml`'s `osv-scan` job calls `google/osv-scanner-action`'s reusable workflow at **v2.7.0 or
  later**, pinned to the tag's commit SHA (`b1d267aea5211fa648d9d442fa64b90dbdcbdd36` for
  v2.7.0; the tag is annotated, so dereference it).
- Moving `packageManager` to a new pnpm major (ADR-1016's stance-review step) includes running
  the OSV container on the new lockfile and **checking that the package count matches the
  dependency tree**, not just that it says "No issues found".
- The local command in `project-conventions` uses the same version, and says to read the count.

## Alternatives considered
- **Stay on v2.3.8 until a project moves to pnpm 12.** The failure gives no signal, so "until"
  would depend on someone remembering. The bump costs nothing on pnpm 11.
- **Scan only the second document**, by splitting the lockfile in CI. That's brittle, and loses
  pnpm's own binaries, which are dependencies too.

## Consequences
- Downstream repos adopt this by copying the ADR and bumping the one `uses:` line (Renovate
  proposes the SHA bump on repos where it runs).
- The rule "read the package count" is general: any scanner that parses a file can parse less of
  it than it should and still say clean.
- Promotion condition: revisit if pnpm changes its lockfile layout again, or if OSV-Scanner
  starts failing on unparsed documents (then the count check becomes belt-and-braces).
