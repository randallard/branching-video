# ADR-1006: Cargo runs with `--locked` in CI
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
CI ran `cargo clippy` and `cargo test` without `--locked`. If `Cargo.lock` is stale, those
commands quietly resolve a different dependency graph from the committed one. That's a
configuration-management gap, and it's where a freshly hijacked version gets in.

## Decision
Every cargo invocation in CI that resolves dependencies uses `--locked`. A stale lockfile fails
the build.

## Consequences
- Lockfile updates are always deliberate, reviewed commits.
