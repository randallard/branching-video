# ADR-1019: HTTP APIs are linted in CI against a vendored, pinned api-standards ruleset
- Status: Accepted
- Date: 2026-11-01
- Deciders: Ryan

## Context
A project that exposes or consumes an HTTP API has a contract, its OpenAPI document. Review
alone doesn't catch most of what goes wrong in a contract: snake_case slipping into one
property, an error response that isn't RFC 9457, a path with no version segment, a collection
with no pagination. Each is cheap to fix while the contract is a draft, and expensive once a
client depends on it.

[`randallard/api-standards`](https://github.com/randallard/api-standards) is a written standard
for HTTP APIs plus a Spectral ruleset that enforces the parts a machine can check. It's built
from Spectral's built-in functions only, so the ruleset is one self-contained YAML file. It's
released by tag.

A ruleset can be reached two ways. One is `extends:` with the raw GitHub URL at a tag, so every
lint run fetches it. The other is a copy committed to the repo. A fetched ruleset needs network
access to GitHub at lint time. Not every runner has it, and a fetch can't show in a diff what
changed between tags.

## Decision
- **A project with an OpenAPI document lints it in CI against `api-standards`, vendored at a
  pinned tag.** `scripts/vendor-api-standards.sh <tag>` copies the ruleset byte-for-byte to
  `.spectral/api-standards.yaml` and records the tag and its SHA-256 in
  `.spectral/api-standards.lock`. It also writes a starter `.spectral.yaml` that extends the
  copy. Bumping the tag means re-running the script and reviewing the diff.
- **`ci.yml` detects, it doesn't wait for opt-in.** `detect` sets `api=true` when `openapi.yaml`
  or `openapi/*.yaml` exists, and the `api-lint` job skips itself otherwise, like the language
  jobs. Only those paths are linted. A third-party specification kept for reference goes
  somewhere else, such as `openapi/vendor/` or `third_party/`.
- **The `api-lint` job checks the copy before it uses it.** It fails if an OpenAPI document
  exists without a `.spectral.yaml`, or if the copy's SHA-256 doesn't match the lock. It runs
  the Spectral standalone binary at a pinned version, verified against a pinned SHA-256 before
  it executes (the same pattern as gitleaks), and fails on warnings (`--fail-severity=warn`).
- **A departure from a rule is an `overrides` entry in `.spectral.yaml`, with its reason in a
  comment**, scoped to the files or paths it covers. A rule is never turned off for the whole
  document.
- **A project bound by a different API standard** records that in a project ADR (ADR-1000) and
  replaces or removes the `api-lint` job.

## Alternatives considered
- **`extends:` by URL.** One line, nothing to bump, but the lint needs GitHub at run time and a
  tag bump has no diff to review. Rejected.
- **Opt-in (run only when `.spectral.yaml` exists).** This avoids surprising a repo that keeps a
  third-party specification at the top level. But a project that forgets to opt in gets no
  check at all, which is the silent failure ADR-1018 is about. Detecting, and asking for the
  ruleset when it's missing, fails loudly instead.
- **Spectral from npm.** Its bundler's dependency tree fails `trustPolicy: no-downgrade`
  (ADR-1016) on a rollup release with no trust evidence. The standalone binary keeps that tree
  out of the lockfile entirely.

## Consequences
- An API project gets a contract check on every push with no setup beyond the script. A
  non-API project sees one skipped job.
- Vendoring means bumps are manual. The stance review checks whether the lock's tag is the
  latest `api-standards` release, and whether every `overrides` entry still has a live reason.
- The Spectral binary is pinned for linux-x64 only. Elsewhere, locally, use your own Spectral
  at the same version.
- Promotion condition: revisit if `api-standards` starts needing custom functions (then it's no
  longer one file, and vendoring means a directory), or if Spectral ships a signed release that
  can replace the pinned digest.
