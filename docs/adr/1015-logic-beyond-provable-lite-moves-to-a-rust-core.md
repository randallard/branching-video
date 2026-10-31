# ADR-1015: UI logic that needs more than provable-lite moves into a Rust core compiled to WASM
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
TypeScript's type system is unsound and has no proof tooling, so provable-lite (rungs 1–3) is
its ceiling. `home-fleet`'s ADR-0001 already preferred a Rust core (Tauri or WASM) over
re-implementing logic in TS. Rust UI frameworks (Leptos, Dioxus) lack a Radix-class
accessibility layer, so switching the UI language isn't the answer.

## Decision
When UI-side logic needs a stronger guarantee than provable-lite, it moves into a Rust crate
compiled to WASM and called from the TS shell, and that crate is held to the Rust tier. The
`new-project` interview asks whether any such logic exists.

## Consequences
- Adds a WASM build step to the projects that need it.
