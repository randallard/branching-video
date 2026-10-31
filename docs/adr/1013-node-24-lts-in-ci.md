# ADR-1013: CI runs Node 24 LTS
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
CI used Node 22, which reaches end of life on 2027-04-30. Node 24 is Active LTS until 2028-04-30.

## Decision
`actions/setup-node` uses `node-version: 24`. A TS project's `engines.node` floor is 24.

## Consequences
- Promotion condition: move to the next LTS when 24 enters maintenance.
