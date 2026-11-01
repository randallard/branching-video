# ADR-1020: CI runs the Active LTS (Node 26); the engines floor stays one LTS behind (24)
- Status: Superseded by [ADR-1022](1022-ci-the-engines-floor-and-types-node-share-the-active-lts.md)
- Date: 2026-11-01
- Deciders: Ryan
- Supersedes: [ADR-1013](1013-node-24-lts-in-ci.md)

## Context
[ADR-1013](1013-node-24-lts-in-ci.md) put CI on Node 24, with a TS project's `engines.node`
floor at 24, and set its own promotion condition: "move to the next LTS when 24 enters
maintenance". That condition is met. Node's release schedule (`nodejs/Release` `schedule.json`,
read 2026-11-01) has:

| Line | Active LTS from | Maintenance from | End of life |
|---|---|---|---|
| 24 (Krypton) | 2025-10-28 | **2026-10-20** | 2028-04-30 |
| 26 (Lithium) | **2026-10-28** (26.13.0) | 2027-10-20 | 2029-04-30 |

A downstream repo moved first. branching-video's ADR-0037 (2026-11-01, the ADR-1000 deviation
path) moved CI to 26 and kept the `engines` floor and `@types/node` at 24. The developer
machines' default Node is still 24, and pnpm fails an install on an unsupported engine
(`ERR_PNPM_UNSUPPORTED_ENGINE`; a Renovate engines pin hit exactly this in that repo). CI there
has run green on 26.13.0, with unit, e2e and supply-chain jobs.

ADR-1013 tied the floor to CI's version. Moving both together would make every local install on
24 fail the day a project picks up this ADR, for no gain: the projects are browser apps and
tools, and nothing needs a Node 26 API.

## Decision
- **CI runs the current Active LTS:** `node-version: 26` in every `setup-node` step.
- **A TS project's `engines.node` floor is the previous LTS line while it's still supported:**
  `>=24.0.0` now. That keeps local builds on 24 working, while CI exercises the newer line.
- **`@types/node` matches the floor (24.x), not CI.** The types then describe the oldest Node the
  project supports, so code can't use a 26-only API by accident. A project that runs Renovate
  holds it with a `packageRules` entry (`matchPackageNames: ["@types/node"]`,
  `allowedVersions: "24.x"`).
- **The cadence:** when the CI line enters maintenance, CI moves to the next Active LTS (next:
  Node 28, around 2027-10). When the floor line reaches end of life, the floor and `@types/node`
  move up one line (24 → 26 by 2028-04-30). Each move is a new 1NNN ADR, as this one is.

## Alternatives considered
- **Floor follows CI (26).** This is ADR-1013's coupling. It breaks every local install on Node 24
  until each machine moves, and buys nothing a 24 floor doesn't.
- **Stay on 24 in CI until it nears end of life.** That ignores ADR-1013's own promotion
  condition, and CI would stop testing on the line new installs default to.
- **Test on both 24 and 26 (a matrix).** Better coverage of the floor, but it doubles every TS
  job's minutes. Revisit if a 24-only failure ever ships, which would show that the floor needs
  its own CI run.

## Consequences
- CI no longer runs on the floor version, so a dependency that needs a Node 26 API could pass CI
  and fail on a 24 machine. The `engines` check doesn't catch a dependency's own requirements.
  Promotion condition for the matrix alternative: the first time that happens.
- Downstream repos adopt this by copying this ADR (and ADR-1013 with its flipped Status), bumping
  each `node-version` to 26, and leaving `engines` and `@types/node` at 24. A repo that already
  deviated the same way (branching-video's ADR-0037) marks its ADR superseded by 1020.
- `compliance-review`'s TypeScript checklist line changes from "Node 24 in CI and the floor
  (ADR-1013)" to "the Active LTS in CI, the previous LTS as the floor and `@types/node`
  (ADR-1020)".
