/** fast-check generators for show configs, shared by the core property tests. */
import fc from "fast-check";
import type { Choice, EndLink, ShowConfig, ShowNode } from "./config.ts";

const nodeId = fc.constantFrom("intro", "a", "b", "c", "aside", "end");
const text = fc.string({ maxLength: 12 });
const seconds = fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true });

const choice: fc.Arbitrary<Choice> = fc.record(
  {
    label: text,
    target: fc.oneof(nodeId, fc.constant("")),
    default: fc.constant(true),
    style: fc.constantFrom("primary", "secondary", "loud"),
  },
  { requiredKeys: ["label", "target"] }
);

const link: fc.Arbitrary<EndLink> = fc.record(
  { label: text, target: nodeId, url: fc.constant("https://example.com") },
  { requiredKeys: ["label"] }
);

const node: fc.Arbitrary<ShowNode> = fc.record(
  {
    id: nodeId,
    title: text,
    videoId: fc.constant("dQw4w9WgXcQ"),
    start: seconds,
    end: seconds,
    showChoicesAt: seconds,
    isAside: fc.constant(true),
    defaultAside: fc.constant(true),
    returnAtCurrentTime: fc.constant(true),
    returnTo: nodeId,
    endScreen: fc.record(
      { heading: text, body: text, links: fc.array(link, { maxLength: 3 }) },
      { requiredKeys: ["links"] }
    ),
    choices: fc.array(choice, { maxLength: 3 }),
  },
  { requiredKeys: ["id", "title", "choices"] }
);

export const arbitraryConfig: fc.Arbitrary<ShowConfig> = fc.record(
  {
    title: text,
    startNode: fc.oneof(nodeId, fc.constant("")),
    choiceDisplaySeconds: fc.integer({ min: 0, max: 60 }),
    masterVideoId: fc.constant("Jvu5VZVe3MI"),
    nodes: fc.array(node, { maxLength: 6 }),
  },
  { requiredKeys: ["title", "startNode", "nodes"] }
);
