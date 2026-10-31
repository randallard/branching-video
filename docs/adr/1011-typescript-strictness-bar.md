# ADR-1011: The TypeScript strictness bar matches what the repos already run
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
The template asked for `strict` + `noUncheckedIndexedAccess` + `strictTypeChecked`. Its own
descendants had gone further and were running stricter than the template that produced them.

## Decision
The bar for every TS project is: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. ESLint
`strictTypeChecked`, with `@typescript-eslint/no-non-null-assertion`,
`@typescript-eslint/switch-exhaustiveness-check` and `@typescript-eslint/no-floating-promises`
as errors. Zero warnings.

## Consequences
- This codifies what's already proven in practice. Relaxing any of it takes a project ADR.
