# ADR-0026 accepted and implemented: CSP on all five pages

Ryan accepted [ADR-0026](../adr/0026-content-security-policy-on-the-player-pages.md) and asked for
it done directly. The change was exactly as small as the ADR estimated: one `<meta http-equiv=
"Content-Security-Policy">` tag, identical content, added to the `<head>` of all five Vite entry
pages (`index.html`, `player.html`, `studio.html`, `editor.html`, `create.html` — confirmed against
`vite.config.ts`'s `pages` list, not guessed):

```
default-src 'self'; script-src 'self' https://www.youtube.com; frame-src https://www.youtube.com;
img-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://www.youtube.com;
object-src 'none'; base-uri 'self'; form-action 'none'
```

`pnpm build` stayed clean. Verified with a throwaway headless-Chromium pass (same style as the
slice-2 smoke test, not committed) against a `vite preview` on a spare port (4321, so Ryan's own
dev server on 8080 was never touched): loaded all five built pages, then loaded `player.html` with
a real live config (`big-buck-bunny.json`) to actually exercise `loadYouTubeApi` and the IFrame API
against the real `www.youtube.com` — zero CSP violations reported in any case. Preview server
stopped afterward.

**Not done:** the ADR also calls for a permanent check in "the 16-check headless smoke test" —
but per [2026-09-14 (2)](2026-09-14-2-slice-2-typescript-port.md), that test is a scratchpad CDP
script, never committed to the repo. There's nothing checked-in to add the check to. If that smoke
test is ever turned into a committed script, a console-CSP-violation assertion belongs in it; until
then this verification is a point-in-time check, not a standing guard against drift.

ADR-0026 flipped from Proposed to Accepted.
