# ADR-0018: Pin every GitHub Action to a full commit SHA
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
Tags are mutable: the `tj-actions/changed-files` compromise (CVE-2025-30066) repointed existing
version tags at a malicious commit. After [ADR-0006](0006-pages-deploy-from-ci-build-artifact.md)
the job that builds `dist/` is the job that deploys what viewers load, so a compromised action
there poisons the live player. Adopted from
[cycle-in ADR-0013](https://github.com/randallard/cycle-in/blob/main/docs/adr/0013-pin-actions-to-commit-shas.md).

## Decision
Every action, first-party included, is pinned to a full-length SHA with the version in a
trailing comment (`# v7`), kept accurate on every bump. The template's workflows arrive
already pinned.

## Consequences
- Bumps are deliberate; Renovate can maintain the SHAs and comments together.
