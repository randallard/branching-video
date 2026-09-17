# 2026-09-17 — Auditing the supply-chain ADRs, and what the SBOM turned out not to say

Ryan asked whether we're actually following the security standards, the SBOM especially. This
entry records the audit, because most of it is "yes" and the parts that aren't are not where I
expected. It documents commit `40272dd`.

## What's genuinely in place

All eight supply-chain ADRs are implemented, and I checked each against the live config and a real
CI run rather than against the ADR text:

- **0012** `ignore-scripts=true`, `onlyBuiltDependencies: []`.
- **0013** all ten devDependencies exact, no ranges, registry pinned, lockfile committed, CI on
  `--frozen-lockfile`.
- **0014** `minimumReleaseAge: 20160` + `trustPolicy: no-downgrade` + `blockExoticSubdeps: true`,
  matched by `renovate.json`'s 14 days.
- **0015** `pnpm audit` clean; `pnpm audit signatures` **285 of 285 verified**; OSV job green. No
  exception files exist, which is correct — there is nothing to excuse.
- **0017** ran the allowlist locally, exit 0.
- **0018** all 22 `uses:` in the three workflows are full 40-hex SHAs, the reusable OSV workflow
  included.

Local re-run: 103 tests, lint clean, docs hygiene clean.

## The SBOM is real, and I was wrong about how to improve it

It is a faithful document: CycloneDX 1.6 from Syft 1.42.3, 303 components, and its 285 `pkg:npm`
entries match the 285 `resolution:` entries in `pnpm-lock.yaml` exactly. It also inventories the 14
pinned GitHub Actions as `pkg:github` components, which is a free cross-check on ADR-0018.

Two things were wrong with it, and one thing I thought was wrong wasn't.

**It didn't say what it described.** `metadata.component` was `{"type":"file","name":"."}`. Fixed by
setting `SYFT_SOURCE_NAME` / `SYFT_SOURCE_VERSION` from `package.json` — verified against the real
Syft container, the subject is now `branching-video@0.1.0`.

**Nothing checked it.** A cataloger that stops matching produces an empty SBOM, and an empty SBOM
uploads and goes green — the job would report success indefinitely while the artifact was worthless.
There's now a floor of 50 components, which fails loudly.

**The missing licence data is correct behaviour, not a defect.** No component carries a `licenses`
field, and my first read was that the job should `pnpm install` first so Syft could catalog
`node_modules`. I ran it before changing anything, and that was wrong twice over:

1. A `pnpm install` alone changes nothing — `javascript-package-cataloger` isn't in the default
   cataloger set for a directory scan, so Syft reads the lockfile either way.
2. Enabling it explicitly produces **548 components for 285 packages**: both catalogers emit every
   package, with different package-ids, so nothing dedupes. The count doubles and every purl
   appears twice.

Worse, the node_modules scan is *less* accurate. It found 31 packages fewer than the lockfile — all
of them native binaries for other platforms (`@rolldown/binding-*`, `lightningcss-*`, `fsevents`),
correctly absent from a Linux install but genuinely part of the dependency set. And it found nine
packages the lockfile doesn't have: `vitest@4.1.8` and its `@vitest/*` siblings — the exact version
[journal 2026-09-14-2](2026-09-14-2-slice-2-typescript-port.md) records moving off because of a
moderate advisory. Those are orphaned directories in my local pnpm store; `node_modules/vitest`
resolves to 4.1.11 and the build is fine. But an SBOM built that way would have listed a withdrawn
vulnerable version as a component of the project, on the strength of files nothing loads.

So the lockfile-only scan stays. It is complete, deduplicated, platform-independent and reproducible.
The reasoning is now a comment in `ci.yml` next to the job, aimed squarely at the next person who
notices the empty `licenses` fields and reaches for the same fix I did. Licences are ADR-0017's
allowlist, which reads a real install and gates on it; the SBOM is an inventory.

## The gap that mattered

None of ADRs 0012–0018 covers anything that runs in a viewer's browser.

There are no runtime `dependencies` at all — all 285 packages are dev-only and none ship. What a
viewer executes is our bundled code plus `https://www.youtube.com/iframe_api`, injected into
`document.head` by `loadYouTubeApi` (`src/shell/youtube.ts`). It is in no manifest, no lockfile, no
SBOM, no scanner and no age gate, and it's re-fetched from Google on every load of the player, the
Studio and the Editor. There is no CSP on any page.

SRI can't help — the loader is a moving target and a pinned hash would break playback on Google's
next change. The control that fits is a CSP that constrains what the page may load at all, so
[ADR-0026](../adr/0026-content-security-policy-on-the-player-pages.md) proposes one. I derived the
origin list by reading the code rather than guessing: `www.youtube.com` is the only external origin
any page contacts, for the API script, the embed, and the oEmbed title lookup in
`src/shell/shows.ts`. No external stylesheets, fonts, images or `data:` URIs exist. It's left
**Proposed** — it changes what ships to viewers, and that's Ryan's call.

## Other changes in this commit

**The OSV scan wasn't gating the deploy.** `deploy` needed only `ts-gates` and `ts-supply-chain`, so
a red OSV scan still published to Pages. It's in `needs` now. ADR-0018's own reasoning — after
ADR-0006, the job that builds `dist/` is the job that publishes what viewers load — applies to the
scanner just as much as to the action pins.

**A stale comment claimed the OSV reusable workflow was "pinned by tag".** It is pinned to a SHA;
the comment predates that and now says why the pin is there.

## Corrections that can't be made where they're wrong

**ADR-0012 names a pnpm field that doesn't exist.** It says exceptions are added to `allowBuilds`.
The field pnpm actually reads, and the one `pnpm-workspace.yaml` correctly uses, is
`onlyBuiltDependencies`. The ADR is Accepted and immutable in substance, so this is the correction:
the decision is right, the field name in it is not, and anyone acting on that line should edit
`onlyBuiltDependencies`.

## Two things I could not settle from here

**`main` has no branch protection** (`gh api …/protection` → 404), and a push to `main` deploys.
`.github/CODEOWNERS` exists, but its own header warns that CODEOWNERS without branch protection only
*requests* a reviewer — "looks like a control and silently isn't". Ryan is handling this.

**Renovate may not be installed.** `renovate.json` is correct, but the repo has never had a pull
request and there are no renovate branches three days after adoption, when onboarding usually lands
within hours. My token lacks the scope to check the app installation. If it isn't installed, the
Renovate half of ADR-0014 and the SHA maintenance ADR-0018 assumes are both doing nothing — worth
30 seconds on the repo's settings page.

## Local hygiene, not a repo issue

My `node_modules/.pnpm` has orphaned `vitest@4.1.8` trees next to the live 4.1.11. Nothing loads
them and CI installs fresh, but `pnpm store prune` would clear them, and it's worth knowing they're
what a node_modules-based SBOM would have reported.
