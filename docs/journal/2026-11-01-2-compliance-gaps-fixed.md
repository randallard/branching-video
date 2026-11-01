# 2026-11-01 (2): the three compliance gaps, fixed

Ryan asked for the gaps from [the first compliance review](../compliance/2026-11-01.md) to be
fixed. One commit each, on `compliance-2026-11-01`:

1. **`.env.example`** (`56a88ce`). It says the app needs no environment: shows and drafts live in
   the browser. The only reader of the environment is `playwright.config.ts` (`E2E_PORT`, `CI`).
2. **Renovate holds TypeScript at 6.0.x** (`eb692c0`). ADR-1010's exit trigger (a) was checked
   first: `npm view typescript-eslint@latest peerDependencies.typescript` is still
   `>=4.8.4 <6.1.0` (8.72.1), so #43 (TypeScript 7) is still ruled out. The rule's
   `allowedVersions` means Renovate closes #43 on its own once this reaches `main`, which avoids
   the "ignored" state a manual close leaves. `renovate.json` was checked as valid JSON only. A
   `renovate-config-validator` run was skipped because it would have fetched an unpinned
   `renovate@latest` past the age gate; the Renovate app validates the config on the PR.
3. **ADR-1019 and the skills** (`8097e9b`). The ADR and the template's current
   `project-conventions` and `stance-review` were copied byte-identical from the template at
   `2f9c1d0`, and ADR-1019 was added to the ADR index. The skill diff is the "HTTP APIs" section,
   stance-review's check 9, and "sealing" → "record confidentiality". There's no `api-lint` job
   or `.spectral/`: no OpenAPI document exists, and the app neither serves nor calls an HTTP API.
   Both arrive with the first contract, from the template.

## Next

Merge, then confirm #43 closes. Then the Renovate triage and Ryan's manual checks, as PROGRESS
lists them.
