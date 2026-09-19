# Architecture Decision Records (ADRs)

Significant decisions for **branching-video**, one file per decision, with the context and
consequences — so the *why* survives, not just the *what*.

The recognized practice is the **ADR** (Michael Nygard, 2011), commonly written with the
**MADR** (Markdown Any Decision Records) template. We use a MADR-lite form.

## Conventions

- Files: `NNNN-kebab-title.md`, zero-padded, monotonically increasing.
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
| [0014](0014-age-gate-dependency-admission.md) | Age-gate new releases at the package manager and the update bot | Accepted |
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
