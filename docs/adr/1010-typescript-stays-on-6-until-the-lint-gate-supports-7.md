# ADR-1010: TypeScript stays on 6.x until the type-aware lint gate supports 7
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
TypeScript 7.0, the Go-native compiler, shipped 2026-07-08 with no programmatic API. The API
arrives in 7.1, which went to beta 2026-10-20, with a final release expected around December. As
of 2026-10-17, typescript-eslint declares `typescript <6.1.0` and throws on 7. TS 6.0 is in
maintenance mode: there will be no 6.1, and patches only for security, serious regressions and
6↔7 compatibility. No end-of-life date has been announced
(https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/).

## Decision
TS projects pin `typescript` to **6.0.x**. There are two exit triggers: (a) `npm view
typescript-eslint@latest peerDependencies.typescript` includes 7.x, or (b) a trial of oxlint +
tsgolint (built on TS 7) passes as the type-aware gate.

## Alternatives considered
- **Run TS 7 and TS 6 side by side** (Microsoft's documented workaround). Rejected because it
  means two compilers to keep in step for a speed gain we don't need yet.

## Consequences
- We forgo TS 7's roughly 10× build speed for now. TS is a build-time tool, so a frozen but
  patched 6.0 is low risk.
- Re-check at TS 7.1 final, and immediately if a 6.0 security issue goes unpatched.
