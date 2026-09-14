# ADR-0010: The single-show config.json stays the publish and interchange format
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
Moving storage to an event log ([ADR-0007](0007-indexeddb-append-only-event-log-storage.md))
raises whether the show file format changes too. Three things depend on the current one:

- The player reads it: `public/live/*.json` and `?config=` URLs.
- [cycle-in's ADR-0004](https://github.com/randallard/cycle-in/blob/main/docs/adr/0004-branching-video-import-time-options-steps-check-ins.md)
  imports a show by parsing this exact shape.
- People already hold exported files — e.g. per-show downloads from Studio and Editor — that
  they expect to load again.

## Decision
The config JSON (`{ title, startNode, choiceDisplaySeconds?, masterVideoId?, nodes[] }`,
documented in `README.md`) remains the format for published shows, for per-show export from
Studio/Editor, and for per-show import. The event log is internal storage and the event bundle
is only the device-to-device backup. Exporting a show reduces its events to this format.

A typed parser/serializer for it lives in `src/core/` and is the only place its shape is
defined; `tools/validate-core.js`'s rules move there.

## Consequences
- Format changes are breaking changes for cycle-in and for published links; additive, optional
  fields only, and `_`-prefixed fields keep being ignored.
- Internal-only data (`showId`, node keys, `order`) never appears in exported configs.
