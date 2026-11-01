# Architecture Decision Records (ADRs)

Significant decisions for **branching-video**, one file per decision, with the context and
consequences — so the *why* survives, not just the *what*.

The recognized practice is the **ADR** (Michael Nygard, 2011), commonly written with the
**MADR** (Markdown Any Decision Records) template. We use a MADR-lite form.

## Conventions

- Files: `NNNN-kebab-title.md`, zero-padded, monotonically increasing.
- **Two number ranges.** `0001`–`0999` are this project's own decisions. **`1000` and up ("1NNN")
  are inherited standards ADRs** from `cr-ci-cd-rust-typescript-template`
  ([ADR-1000](1000-template-standards-adrs-are-inherited.md)). The same number means the same
  decision in every project built from the template. Copied in, never edited here; a deviation is
  a project ADR that cites the 1NNN it departs from.
- Status values: `Proposed` · `Accepted` · `Superseded by ADR-XXXX` · `Deprecated`.

### One decision per file

An ADR records **one** decision. If your file has a numbered list of decisions in it, you have
written a policy document, not an ADR — split it.

The test: **if you can't supersede one part of it, it's too big.** A file bundling eleven
decisions can never be superseded, because a new ADR replacing it would throw out the ten that
were fine. So the only available move becomes editing it in place — which is how bloat quietly
destroys immutability. These are not two separate failures; the first causes the second.

`docs-hygiene` warns when an ADR crosses the size tripwire. Treat the warning as a prompt to
split, not a number to tune.

### Immutable in substance

To change a decision, write a **new** ADR that supersedes the old one, and flip the old one's
status to `Superseded by ADR-XXXX`. Don't rewrite history.

Precisely what that allows and forbids:

| Part of the file | Mutable? |
|---|---|
| The `- Status:` line | ✅ that's what it's for |
| The index table in this README | ✅ it's an index |
| Typo / broken-link fixes | ✅ |
| `## Context`, `## Decision`, `## Consequences` | ❌ **frozen once Accepted** |
| Adding a new decision to an existing ADR | ❌ **write a new ADR** |
| "Amended on <date>" blocks | ❌ that's an edit wearing a hat |

If you find yourself writing "amended" inside an accepted ADR, stop: what you have is a new
decision, and it deserves its own number and its own supersession link.

### Superseding

1. Write `NNNN-new-title.md` with the new decision. In its Context, say what it replaces and
   **why the old reasoning stopped holding** — that's the valuable part, and it's the thing
   an in-place edit destroys.
2. In the old ADR, change only the Status line to `Superseded by [ADR-NNNN](NNNN-new-title.md)`.
3. Update the index below.

A superseded ADR stays in the repo, unedited, forever. Someone reading the new one needs to see
what was believed before and what changed.

## Template

Copy [`TEMPLATE.md`](TEMPLATE.md).

```markdown
# ADR-NNNN: <title>
- Status: Proposed | Accepted | Superseded by ADR-XXXX
- Date: YYYY-MM-DD
- Deciders: <names>

## Context
<forces at play, constraints, what makes this non-obvious>

## Decision
<what we chose, stated plainly — ONE decision>

## Consequences
<results, good and bad; what this commits us to>
```

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0000](0000-record-architecture-decisions.md) | Record architecture decisions (use ADRs) | Accepted |
| [0001](0001-bulk-backup-single-json-bundle-merge-by-slug.md) | Bulk backup as a single JSON bundle, merge-by-slug on import | Superseded by 0002 (overwrite) and 0007 (format) |
| [0002](0002-import-conflict-resolution-per-draft-choice.md) | Import conflict resolution — per-draft keep-mine/keep-theirs/keep-both | Superseded by 0008 |
| [0003](0003-retrofit-cr-ci-cd-template-onto-existing-repo.md) | Retrofit the cr-ci-cd-rust-typescript-template conventions onto this repo | Accepted |
| [0004](0004-provable-lite-strict-typescript-and-property-tests.md) | Provable-lite — strict TypeScript, pure core, fast-check; no Rust | Accepted |
| [0005](0005-vite-multi-page-build-replaces-no-build-html.md) | Vite multi-page build replaces the no-build static HTML | Superseded by 0020 |
| [0006](0006-pages-deploy-from-ci-build-artifact.md) | GitHub Pages deploys the CI build artifact, not the branch root | Accepted |
| [0007](0007-indexeddb-append-only-event-log-storage.md) | Drafts live in an IndexedDB append-only event log; backups are event bundles | Accepted |
| [0008](0008-edit-level-events-per-field-last-writer-wins.md) | Edit-level events, resolved per field by last writer | Accepted |
| [0009](0009-show-identity-by-generated-id-not-slug.md) | A show's identity is a generated id, not the slug of its title | Accepted |
| [0010](0010-config-json-stays-the-publish-and-interchange-format.md) | The single-show config.json stays the publish and interchange format | Accepted |
| [0011](0011-legacy-drafts-and-backups-import-as-snapshot-events.md) | Existing drafts, old backups and single-show files enter the log as snapshot events | Accepted |
| [0012](0012-block-install-time-scripts.md) | Block install-time script execution | Accepted |
| [0013](0013-pin-exact-versions-restrict-registry.md) | Exact dependency versions, one registry, frozen lockfile | Accepted |
| [0014](0014-age-gate-dependency-admission.md) | Age-gate new releases at the package manager and the update bot | Superseded by 0030 |
| [0015](0015-ci-vulnerability-scanning.md) | CI vulnerability scanning — pnpm audit, OSV-Scanner, signatures | Accepted |
| [0016](0016-sbom-via-syft.md) | Generate the SBOM with Syft in CI | Accepted |
| [0017](0017-license-allowlist.md) | Enforce a dependency licence allowlist in CI | Accepted |
| [0018](0018-pin-actions-to-commit-shas.md) | Pin every GitHub Action to a full commit SHA | Accepted |
| [0019](0019-dual-mit-apache-license.md) | License the project MIT OR Apache-2.0 | Accepted |
| [0020](0020-vite-multi-page-build-with-relative-base.md) | Vite multi-page build with a relative asset base | Accepted |
| [0021](0021-generate-show-manifest-at-build.md) | Generate live/manifest.json from public/live in dev and at build | Accepted |
| [0022](0022-no-choice-nodes-continue-to-next-node.md) | A node with no way forward continues into the next node in order | Accepted |
| [0023](0023-per-field-value-history.md) | A superseded field value is recoverable from a per-field history | Accepted |
| [0024](0024-node-removal-collisions-ask-rather-than-resolve.md) | A node deleted on one device and edited on another asks, rather than resolving silently | Accepted |
| [0025](0025-snapshot-node-keys-derived-from-node-id.md) | Snapshot node keys are derived from the node's id, with a content-hash fallback | Accepted |
| [0026](0026-content-security-policy-on-the-player-pages.md) | Constrain what a page may load with a Content-Security-Policy meta tag | Accepted |
| [0027](0027-playwright-browser-tests-against-the-built-site.md) | Browser behaviour is tested by a committed Playwright suite against the built site | Accepted |
| [0028](0028-unload-backstop-in-localstorage-replayed-at-edit-time.md) | Edits not yet in IndexedDB are parked in localStorage on unload and replayed at edit time | Accepted |
| [0029](0029-same-device-handoffs-carry-the-show-id-not-the-config.md) | Handoffs between pages on the same device carry the show id, not the config | Accepted |
| [0030](0030-one-day-age-gate.md) | The age gate is one day, not fourteen | Accepted |
| [0031](0031-a-lone-default-choice-advances-without-choice-ui.md) | A node whose only choice is the default advances to it without showing choices | Accepted |
| [0032](0032-every-cast-is-registered.md) | Every `any` and type assertion is registered, with its reason, and CI checks it | Accepted |
| [0033](0033-accessibility-checks-with-axe.md) | Accessibility is checked with axe against every page in CI | Accepted |
| [0034](0034-editor-and-studio-edit-a-working-copy-diffed-into-events.md) | The Editor and Studio edit a working copy that is diffed into events | Accepted |
| [0035](0035-move-to-pnpm-12.md) | Move to pnpm 12, with the lockfile regenerated in its own change | Accepted |
| [0036](0036-the-players-position-is-one-pure-reducer.md) | The player's position is one pure reducer | Accepted |
| [0037](0037-ci-runs-node-26-lts-ahead-of-the-template.md) | CI runs Node 26 LTS, ahead of the template; the engines floor stays 24 | Accepted |
| [1000](1000-template-standards-adrs-are-inherited.md) | Template standards ADRs are inherited, numbered 1000 and up | Accepted |
| [1001](1001-project-conventions-is-the-canonical-standard.md) | project-conventions is the canonical provable-code standard | Accepted |
| [1002](1002-provable-is-a-four-rung-ladder.md) | "Provable" means a four-rung ladder, and a project claims only the rungs CI enforces | Accepted |
| [1003](1003-provable-plus-tier-verus-for-named-invariants.md) | Opt-in provable+ tier: Verus for named invariants, with a human-reviewed spec | Accepted |
| [1004](1004-kani-job-fails-without-harnesses.md) | The Kani CI job fails when there are no proof harnesses | Accepted |
| [1005](1005-every-ci-job-has-a-timeout.md) | Every CI job has a timeout: 30 minutes for proofs, 15 for the rest | Accepted |
| [1006](1006-cargo-runs-locked-in-ci.md) | Cargo runs with `--locked` in CI | Accepted |
| [1007](1007-one-day-crate-cooldown-via-cargo-min-publish-age.md) | New crate versions wait one day, via Cargo's native `min-publish-age` | Accepted |
| [1008](1008-build-scripts-are-the-rust-attack-surface.md) | Build scripts and proc-macros are treated as the Rust attack surface | Accepted |
| [1009](1009-miri-runs-without-secrets-or-shared-target-cache.md) | Miri runs without secrets and without a shared `target/` cache | Accepted |
| [1010](1010-typescript-stays-on-6-until-the-lint-gate-supports-7.md) | TypeScript stays on 6.x until the type-aware lint gate supports 7 | Accepted |
| [1011](1011-typescript-strictness-bar.md) | The TypeScript strictness bar matches what the repos already run | Accepted |
| [1012](1012-strictness-extras-offered-at-project-start.md) | Engineering-Strategy's TS extras are offered as an opt-in at every project start | Accepted |
| [1013](1013-node-24-lts-in-ci.md) | CI runs Node 24 LTS | Accepted |
| [1014](1014-npm-trusted-publishing-hygiene.md) | npm trusted publishing: bind by repository ID, never from comment- or fork-triggered workflows | Accepted |
| [1015](1015-logic-beyond-provable-lite-moves-to-a-rust-core.md) | UI logic that needs more than provable-lite moves into a Rust core compiled to WASM | Accepted |
| [1016](1016-pnpm-supply-chain-settings-stay-explicit.md) | pnpm supply-chain settings stay explicit, and major pnpm bumps are evaluated first | Accepted |
| [1017](1017-state-is-managed-facts-managed-position-derived-values.md) | State is managed facts, managed position and derived values, and a screen's transitions go through one pure, property-tested reducer | Accepted |
| [1018](1018-osv-scanner-reads-the-whole-lockfile.md) | OSV-Scanner is at least v2.7.0, and a scan is read by its package count, not just its verdict | Accepted |
| [1019](1019-http-apis-lint-against-a-vendored-api-standards-ruleset.md) | HTTP APIs are linted in CI against a vendored, pinned api-standards ruleset | Accepted |
