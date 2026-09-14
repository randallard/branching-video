# ADR-0019: License the project MIT OR Apache-2.0
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
The repo is public and invites forking (`create.html`, the README's deploy steps), but has no
licence file, which legally means no one may reuse it. The template ships dual
`MIT OR Apache-2.0` (cycle-in, which predates that default, is MIT alone).

## Decision
Dual `MIT OR Apache-2.0`: `LICENSE-MIT` and `LICENSE-APACHE` at the root, `"license":
"MIT OR Apache-2.0"` in `package.json`.

## Alternatives considered
- **MIT alone**, matching cycle-in — rejected: Apache-2.0 adds an explicit patent grant at no
  cost to MIT's permissiveness, and the dual form is the template default.

## Consequences
- Forkers may choose either licence. Show configs and videos people publish with a fork are
  their own content and are not covered by the code licence.
