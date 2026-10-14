# 2026-10-14 — transitive advisories turned `main` red; one has no usable patch yet

Documents `ea6de0e`.

Renovate PRs #15, #16 and #19 all failed `ts supply chain` and `OSV scan`, but not because of
what they changed: `main`'s own lockfile had picked up new advisories (undici, brace-expansion,
source-map-js, ip-address, postcss-selector-parser, http-cache-semantics), all reached only
through dev tooling. `main` requires branches to be up to date, so every open PR was blocked
behind the same red check.

Fixed with `pnpm-workspace.yaml` overrides scoped to the major already resolved (so none can jump
a major version). **http-cache-semantics** is the exception: its only patched release (4.3.0)
was published 2026-10-04, inside the 14-day ADR-0014 quarantine, so GHSA-ch52-4w7c-c8xp is
ignored in both `pnpm-workspace.yaml` and the new `osv-scanner.toml` until **2026-10-18**, when
the override can replace the ignore. Verified locally: lint, 135 unit tests, build,
`pnpm audit`, and the OSV scanner container ("No issues found").

Merge order after this lands: this PR first, then Renovate rebases the rest; the
ADR-0029 branch (`transfer-handoff-by-show-id`) rebases onto `main` after that.
