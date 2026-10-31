# ADR-0032: Every `any` and type assertion is registered, with its reason, and CI checks it
- Status: Accepted
- Date: 2026-10-31
- Deciders: Ryan

## Context
[ADR-1012](1012-strictness-extras-offered-at-project-start.md) offers two extras that every
project answers yes or no in an ADR. This is the first, the `any` registry; the second is
[ADR-0033](0033-accessibility-checks-with-axe.md). It was PROGRESS item T3, and became an
obligation when the inherited ADRs were copied in.

The baseline lint already keeps out `any` (there are none), so the registry polices `as`. A count
from the TypeScript syntax tree found 39 assertions, 17 in app code and 22 in tests.

## Decision
Every `any`, and every type assertion other than `as const`, in `src/` (tests included):
- carries a `// cast (any-registry): <why it's sound>` comment directly above it;
- is counted per file in [`docs/any-registry.md`](../any-registry.md), with its kind and reason;
- and `tools/any-registry-check.ts` (`pnpm casts`, run in CI) fails when a file's count and the
  registry disagree, or a cast has no comment. It reads the syntax tree, so comments and strings
  don't count, and `x as unknown as T` counts once.

A cast whose reason can't be written is replaced with a check, not registered.

## Alternatives considered
- **No registry.** Lint can't tell a narrowing right after a guard from an unchecked trust in
  input, and writing the reasons here removed 14 casts (below).
- **A registry kept by hand.** Another project in this family adopted one and found casts its
  hand sweeps had missed, twice. Hence the check.

## Consequences
- Writing the reasons removed 14 of the 39: 12 test fixtures cast `as ShowEvent[]` were all
  valid events, so they are `satisfies` now and a typo'd field fails to compile; `cloneNode`'s
  `as JsonRecord` is now an `isRecord` check; and `byId`'s default constructor, which let a
  caller name an element type that was never checked, is now a pair of overloads.
- Several remaining casts rest on one invariant in the reducer: field history is recorded from
  the node *after* normalization. The registry names it, so a change there knows what depends
  on it.
- The check is the same script cycle-in uses (`scripts/any-registry-check.ts` there), here in
  `tools/` beside `validate-config.ts`.
- Promotion condition: none; revisit if the count grows past what a reviewer reads in one pass
  (say 60).
