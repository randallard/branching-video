# ADR-0037: CI runs Node 26 LTS, ahead of the template; the engines floor stays 24
- Status: Accepted
- Date: 2026-11-01
- Deciders: Ryan

## Context
[ADR-1013](1013-node-24-lts-in-ci.md) (inherited) puts CI on Node 24 with an `engines.node`
floor of 24, and gives its own promotion condition: "move to the next LTS when 24 enters
maintenance". That has happened. Node's release schedule
(`nodejs/Release` `schedule.json`, read 2026-11-01) has Node 24 entering maintenance on
2026-10-20, and Node 26 ("Lithium") becoming Active LTS on 2026-10-28 with 26.13.0. Node 26 is
supported until 2029-04-30.

Renovate opened #42 to move CI's `node-version` and `@types/node` to 26. Under
[ADR-1000](1000-template-standards-adrs-are-inherited.md) an inherited ADR is never edited or
flipped here. Only the template supersedes it, so a project that moves first records the
deviation in its own ADR. That is this ADR.

The local default Node on Ryan's machine is 24 (24.16.0, with 26.2.0 also installed through
mise). The app is a static site, so Node is only a build and test tool, and nothing here needs a
Node 26 API.

## Decision
- **CI runs Node 26**: `node-version: 26` in every `setup-node` step.
- **The `engines.node` floor stays `>=24.0.0`, and `@types/node` stays on 24.x.** The types
  describe the oldest Node the repo supports, so `tools/*.ts` can't use a 26-only API by
  accident. A Renovate rule holds `@types/node` at 24.x while the floor is 24.
- CI on the newer LTS and a floor on the older one together mean every gate runs on 26 and a
  local build on 24 still installs. The floor moves to 26 in a change of its own, when 24 reaches
  end of life (2028-04-30) or when something here needs 26.

## Alternatives considered
- **Stay on 24 until the template moves.** This is compliant, but ADR-1013's own promotion
  condition is met, and Ryan chose to move.
- **Take #42 whole (`@types/node` 26 too).** The types would then promise APIs that a Node 24
  build doesn't have.
- **Raise `engines.node` to 26.** pnpm fails the install on an unsupported engine
  (`ERR_PNPM_UNSUPPORTED_ENGINE`, which is what sank Renovate #2's engines pin), so every local
  build on the default Node 24 would break.

## Consequences
- This deviates from ADR-1013 until the template supersedes it. The template should get a 1NNN
  ADR moving to Node 26 (its promotion condition is met). When it lands, inherit it and mark this
  ADR superseded if the two agree.
- Renovate #42 closes once `main` has `node-version: 26` and the `@types/node` rule.
- A Node-26-only behaviour difference would show up in CI and not locally. The e2e and unit
  suites run on 26 in CI on every PR, which is the check that matters.
