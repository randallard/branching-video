# ADR-0004: Provable-lite — strict TypeScript, pure core, fast-check properties; no Rust
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
The app is a static browser UI over the YouTube IFrame API with no backend. The template's
tiers are provable-lite (TypeScript) and provable (Rust with `kani`). The logic worth getting
right is small and pure-shaped: config validation, node routing (default choices, asides,
`returnTo`, resume-at-branch-point), and — after [ADR-0007](0007-indexeddb-append-only-event-log-storage.md)
— the reducer and import merge. Today none of it is tested and it is interleaved with DOM and
`localStorage` calls.

[cycle-in](https://github.com/randallard/cycle-in) runs this exact tier on the same stack and is
the working reference.

## Decision
TypeScript throughout, provable-lite tier:

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; ESLint
  `strictTypeChecked`, zero warnings.
- `src/core/` is pure: no DOM, storage, network, clock or randomness (ids and timestamps are
  injected). `src/shell/` holds IndexedDB, YouTube, file IO; `src/ui/` holds page wiring.
- `fast-check` property tests on the core asserting real invariants — at minimum: the reducer
  is a function of the event *set* (permutation- and duplication-invariant); importing the same
  file twice changes nothing; importing never removes a show that existed before; routing from
  any node of a validated config reaches a defined node or an end screen.

## Alternatives considered
- **Rust core compiled to WASM** — rejected: adds a toolchain and a JS/WASM boundary to a
  project whose core is a few hundred lines of graph and merge logic; no invariant here needs
  proofs to be trusted.
- **Stay JavaScript with JSDoc types** — rejected with the conventions-only option in
  [ADR-0003](0003-retrofit-cr-ci-cd-template-onto-existing-repo.md).

## Consequences
- TypeScript's type system is unsound; the compiler is a first check and the property tests
  carry the rigor.
- `tools/validate-core.js` (today shared by the CLI and `editor.html`) becomes a typed core
  module; the CLI becomes a thin shell over it.
- **Promotion condition:** if the event model grows invariants that property tests keep
  missing (e.g. a merge bug found by use rather than by a test), revisit a stronger tier via a
  new ADR.
