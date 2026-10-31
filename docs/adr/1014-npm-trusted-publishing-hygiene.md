# ADR-1014: npm trusted publishing: bind by repository ID, never from comment- or fork-triggered workflows
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
In 2026, npm worm waves published through legitimate trusted-publishing pipelines. On 2026-10-13
"SlugFest" showed that a binding by repository *name* could be claimed by whoever took over a
renamed or deleted repo's name. Over 1,500 packages were exposed
(https://thehackernews.com/2026/10/github-tightens-npm-publishing-after.html). No project here
publishes to npm today.

## Decision
A project that publishes to npm binds trusted publishing to its repository ID, re-binds after
any rename or transfer, and never publishes from `issue_comment` or `pull_request_target`
workflows.

## Consequences
- No cost until something publishes.
