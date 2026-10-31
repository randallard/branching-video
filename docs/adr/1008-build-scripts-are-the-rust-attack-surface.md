# ADR-1008: Build scripts and proc-macros are treated as the Rust attack surface
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
`build.rs` and procedural macros run arbitrary code at build time, with the full permissions of
whoever runs the build. That's where the 2026 `arrayref` payload ran. Cargo has no sandbox for
them yet. This is the Rust analogue of npm install scripts, which the TS side blocks by default.

## Decision
When adding or updating a dependency: do the first build in an ephemeral container or in CI, not
on a workstation with credentials. Read the `build.rs` and any proc-macro of every new **direct**
dependency. Add known-bad names to `cargo-deny`'s `[bans]`. The conventions say all this
explicitly.

## Consequences
- Adding a dependency takes some extra minutes. That's intended.
- Promotion condition: if Cargo ships build-script sandboxing, adopt it.
