# ADR-1021: Projects start with a Renovate config that encodes the standards it could break
- Status: Accepted
- Date: 2026-11-01
- Deciders: Ryan

## Context
The template pins every action to a SHA and every dependency exactly, and says Renovate keeps
those pins current (README, "Every action is pinned…"; `.github/CODEOWNERS` owns
`/renovate.json`). But it shipped no `renovate.json`, so each project wrote its own. Two did, and
converged on the same file the hard way:

- **Override ranges and `engines` must not be pinned.** Pinning `engines.node` to the latest
  release failed every install (`ERR_PNPM_UNSUPPORTED_ENGINE`, branching-video #2, 2026-09), and an
  override's bounded range (a floor that clears an advisory, below the next major) is deliberate.
- **TypeScript must stay on 6.0.x** ([ADR-1010](1010-typescript-stays-on-6-until-the-lint-gate-supports-7.md)).
  Without a rule, Renovate opened a TypeScript 7 PR (branching-video #43, 2026-11-01).
- **`@types/node` follows the `engines` floor, and CI's `node-version` is a line, not a patch**
  ([ADR-1020](1020-ci-runs-the-active-lts-and-the-engines-floor-trails-it.md)). Without rules,
  Renovate proposed `@types/node` 26 (#42) and pinned `node-version: 26` to `26.13.0` (#2 again),
  which would freeze the security patches `setup-node` otherwise picks up on every run.

Each of these was found by a red install or a PR that contradicted an ADR, in each repo
separately.

The template itself is a special case. Its GitHub copy is a squash mirror of a local `main`, and
each sync commits local `main`'s tree on top of GitHub's. A Renovate PR merged on the mirror would
be silently undone by the next sync unless someone brought it back into local `main` first. The
template's own action pins have meanwhile lagged what downstream Renovate had already merged and
run (2026-11-01: checkout, setup-node, pnpm/action-setup, sbom-action, upload-artifact and
deploy-pages, each one to three releases behind).

## Decision
- **The template ships `renovate.json`**, so every project starts with it:
  - `config:recommended` and `helpers:pinGitHubActionDigestsToSemver` (actions pinned to SHAs,
    with the version kept in the comment);
  - `minimumReleaseAge: "1 day"`, matching the one-day age gate in `pnpm-workspace.yaml` and
    `.cargo/config.toml` ([ADR-1007](1007-one-day-crate-cooldown-via-cargo-min-publish-age.md),
    [ADR-1016](1016-pnpm-supply-chain-settings-stay-explicit.md));
  - `rangeStrategy: "pin"`, with lockfile maintenance on;
  - rules: no updates for `pnpm-workspace.overrides` and `engines`; `typescript` held at 6.0.x
    (ADR-1010); `@types/node` held to the `engines` floor line (ADR-1020); and
    `rangeStrategy: "replace"` for the `github-actions` `node` dependency (ADR-1020), so it isn't
    pinned to a patch but a new major still opens a PR.
  - Each rule's `description` names the ADR it encodes. When that ADR is superseded, the rule
    changes in the same commit.
- **Renovate is not installed on the template's GitHub mirror.** The template's own pins are
  bumped by hand, at each mirror sync or stance review, to the versions downstream Renovate has
  already merged and run green. Actions only the template's Rust jobs use have no downstream
  source yet; they're checked against their releases by hand.

## Alternatives considered
- **Renovate on the mirror, with the sync pulling merged changes back first.** It keeps the
  template's pins current on their own, but adds a manual step to every sync, and a sync that
  forgets it reverts a security bump without anyone noticing.
- **Each project writes its own config.** That's how it was, and two projects rediscovered the
  same three problems.
- **Put the rules in a shared preset repo** (`extends: ["github>…"]`). One source for every
  project, but a project's config would then change without a commit in that project, and the
  preset becomes a supply-chain dependency of its own.

## Consequences
- A project picks this up by copying `renovate.json` (or merging its rules into an existing one)
  and this ADR. Rules a project has added stay. Install the Renovate app on the project's repo.
- The template's pins can trail downstream by up to one sync. That's acceptable, since a new
  project gets Renovate PRs for them in its first run.
- Promotion condition: if a sync ever ships a template pin older than one downstream had already
  replaced for a security fix, reconsider running Renovate on a dedicated mirror clone.
