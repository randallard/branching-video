# ADR-1009: Miri runs without secrets and without a shared `target/` cache
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
Miri saved environment variables into `target/`. CI that caches `target/` (as `Swatinem/rust-cache`,
used here, does) could then leak secrets into caches that pull-request jobs read
(https://blog.rust-lang.org/2026/09/21/github-actions-leaking-secrets-when-miri-output-is-cached/).
Fixed upstream on nightly 2026-09-22. No project here runs Miri today.

## Decision
A CI job that runs `cargo miri` has no secrets in its environment and doesn't share a cached
`target/` with other jobs.

## Consequences
- This is a rule held in reserve, at no cost until someone adds Miri.
