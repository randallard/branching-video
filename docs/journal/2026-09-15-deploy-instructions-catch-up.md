# 2026-09-15 — Deploy instructions catch up with the deploy

Follow-up to the [2026-09-14 (2)](2026-09-14-2-slice-2-typescript-port.md) cutover, which noted
its own miss: the site had moved to an Actions build, but `README.md`'s "Deploy" section and
`create.html` step 2 still told a forker to point Pages at `main` / root. That advice is worse
than stale now — the branch root holds `.ts` sources and HTML that references them, so following
it would serve a site that never runs. Both now say: Pages source = **GitHub Actions**, plus a
`DEPLOY_PAGES=true` repository variable, in that order, with the reasoning linked to
[ADR-0006](../adr/0006-pages-deploy-from-ci-build-artifact.md) and the relative-base promise to
[ADR-0020](../adr/0020-vite-multi-page-build-with-relative-base.md) so a forker knows the build
works under their own repo name without editing anything.

## The other half of the same mistake

Going looking for the branch-root instructions turned up three more places that were written
when there genuinely was no build step, and that the slice-2 port had quietly falsified:

- README's opening line, "Just a JSON config, a single HTML file, and free static hosting."
- README's "Adding new content" closer, "No rebuilding. No compile step."
- `create.html`'s lede, "no platform, no monthly fee, no build step."

The *spirit* of all three still holds — there's still no server, no platform, no monthly fee, and
adding a show is still a JSON file and a push. Only the "no build" half became false. So they
were reworded to keep the promise and drop the claim, rather than deleted: the selling point was
never the absence of a build, it was the absence of anything to operate.

Worth noting for next time: the cutover ADR and the cutover itself were both careful, and the
docs miss still happened, because "change the deploy" and "change the instructions describing the
deploy" felt like one task and were two. The user-facing copy lives in files (`README.md`,
`create.html`) that no gate reads for meaning — docs hygiene checks links and statuses, not
whether a sentence is still true.

## Verified

`python3 scripts/docs-hygiene.py` clean (one pre-existing warning: no stance review recorded
yet), `pnpm lint` clean, `pnpm build` green. `create.html` gained a nested `<ol>` for the two
settings; `ol.steps > li` uses a child combinator, so the numbered-circle styling doesn't leak
into it, and a small rule was added for the inner list's spacing. Left uncommitted for Ryan:
`create.html` is a page people read, and pushing it redeploys the site — so the rewritten step is
now also on the browser-pass list.
