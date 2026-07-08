# ADR-0000: Record architecture decisions (use ADRs)
- Status: Accepted
- Date: 2026-07-08
- Deciders: Ryan

## Context
branching-video is a small, single-maintainer app, but it already carries non-obvious
choices (localStorage as the only persistence layer, a slug-keyed draft index, JSON-config
+ single-HTML-player architecture with no backend). Decided in conversation, the rationale
would be lost the next time context is cleared. Same need already addressed the same way in
the companion git-redundancy and home-fleet projects.

The recognized format is the **ADR** (Architecture Decision Record, Nygard 2011), commonly
written with the **MADR** Markdown template.

## Decision
Keep an ADR log under `docs/adr/`, one file per decision, MADR-lite template (see
`README.md`). ADRs are immutable in substance — supersede rather than rewrite.

## Consequences
- The *why* behind storage/format/UI decisions is preserved and reviewable in-repo, alongside
  the plain HTML/JS it governs.
- Small per-decision overhead; a supersession chain instead of edits.
