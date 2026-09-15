/**
 * What happens when a segment finishes playing — the player's routing rule, pure so it can be
 * property-tested and shared with the validator's reachability check.
 *
 * Precedence (ADR-0022 added the `continue` step):
 *   1. choices already showing mid-segment → the countdown owns the next step (player-side);
 *   2. no choices + `returnAtCurrentTime` + a captured branch point → resume there;
 *   3. no choices + aside with `returnTo` → go there;
 *   4. no choices + `endScreen` → show it;
 *   5. no choices + a next node in config order → continue to it;
 *   6. no choices, last node → the generic "That's a wrap / Watch again" screen;
 *   7. otherwise → show the node's choices.
 */
import type { EndScreen, ShowConfig, ShowNode } from "./config.ts";

export type SegmentEnd =
  | { kind: "resume-branch" }
  | { kind: "return-to"; nodeId: string }
  | { kind: "end-screen"; endScreen: EndScreen }
  | { kind: "continue"; nodeId: string }
  | { kind: "wrap" }
  | { kind: "choices" };

/** The routing-relevant facts about a node, so raw (unvalidated) configs can use the rule too. */
export interface RouteShape {
  hasChoices: boolean;
  isAside: boolean;
  returnTo: string;
  hasEndScreen: boolean;
}

export function routeShape(n: ShowNode): RouteShape {
  return {
    hasChoices: n.choices.length > 0,
    isAside: n.isAside === true,
    returnTo: n.returnTo ?? "",
    hasEndScreen: n.endScreen !== undefined,
  };
}

/** True when a node, having played to its end without a captured branch point, plays on into
 * the next node in config order (ADR-0022). */
export function continuesToNext(s: RouteShape): boolean {
  return !s.hasChoices && !(s.isAside && s.returnTo) && !s.hasEndScreen;
}

export function segmentEndAction(
  config: ShowConfig,
  node: ShowNode,
  hasBranchPoint: boolean
): SegmentEnd {
  if (node.choices.length > 0) return { kind: "choices" };
  if (node.returnAtCurrentTime && hasBranchPoint) return { kind: "resume-branch" };
  if (node.isAside && node.returnTo) return { kind: "return-to", nodeId: node.returnTo };
  if (node.endScreen) return { kind: "end-screen", endScreen: node.endScreen };
  const next = config.nodes[config.nodes.indexOf(node) + 1];
  return next ? { kind: "continue", nodeId: next.id } : { kind: "wrap" };
}
