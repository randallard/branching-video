/**
 * The player's position (ADR-0036, ADR-1017): which node is playing, where it started, the branch
 * point an aside returns to, and how far the segment's choices have got. One pure reducer with
 * named actions; the page owns the YouTube player, the timers and the DOM, and reads the clock in
 * at the moments an action needs it.
 */
import type { ShowConfig, ShowNode } from "./config.ts";

/** Where a `returnAtCurrentTime` aside was entered from, on the main line. */
export interface BranchPoint {
  nodeId: string;
  time: number;
}

export interface Playback {
  /** The node playing, or null before the first navigation. */
  nodeId: string | null;
  /** Where this segment started, in seconds: the node's `start`, or the branch point on resume. */
  startAt: number;
  /** Set only while an aside plays; always names a main-line node. */
  branch: BranchPoint | null;
  /** The segment has reached PLAYING. Until then YouTube's ENDED events are spurious. */
  ready: boolean;
  /** The mid-segment choice cue has fired, or the segment started past it. */
  cueSpent: boolean;
  /** Choices are on screen, so the countdown owns the next step. */
  choicesVisible: boolean;
}

export type PlaybackAction =
  /** `at` is the clock as the current segment is left; it becomes the branch point if one is taken. */
  | { type: "navigate"; nodeId: string; at: number | null }
  | { type: "resume" }
  | { type: "playing" }
  /** Choices go only by leaving the segment: every way off them (a click, the countdown) navigates. */
  | { type: "show-choices" };

export const initialPlayback: Playback = {
  nodeId: null,
  startAt: 0,
  branch: null,
  ready: false,
  cueSpent: false,
  choicesVisible: false,
};

/** Seconds past `end` before the player stops waiting for YouTube's ENDED and ends it itself. */
export const END_BACKSTOP_TOLERANCE = 0.25;

/** The last node with this id, as the page's id map resolves a (validator-rejected) duplicate. */
function findNode(show: ShowConfig, id: string | null): ShowNode | undefined {
  let found: ShowNode | undefined;
  for (const n of show.nodes) if (n.id === id) found = n;
  return found;
}

function enter(node: ShowNode, startAt: number, branch: BranchPoint | null): Playback {
  return {
    nodeId: node.id,
    startAt,
    branch,
    ready: false,
    // Resuming past the cue doesn't re-fire it; the segment's end still shows the choices.
    cueSpent: typeof node.showChoicesAt === "number" && startAt >= node.showChoicesAt,
    choicesVisible: false,
  };
}

export function reducePlayback(show: ShowConfig, p: Playback, action: PlaybackAction): Playback {
  switch (action.type) {
    case "navigate": {
      const node = findNode(show, action.nodeId);
      if (!node) return { ...p, ready: false, choicesVisible: false };
      const from = findNode(show, p.nodeId);
      let branch: BranchPoint | null = null;
      if (node.isAside) {
        // Taken only when leaving the main line, so a nested aside keeps the original anchor.
        branch =
          node.returnAtCurrentTime && from && !from.isAside && action.at !== null
            ? { nodeId: from.id, time: action.at }
            : p.branch;
      }
      return enter(node, typeof node.start === "number" ? node.start : 0, branch);
    }
    case "resume": {
      const anchor = p.branch && findNode(show, p.branch.nodeId);
      if (!p.branch || !anchor) return p;
      return enter(anchor, p.branch.time, null);
    }
    case "playing":
      return p.ready ? p : { ...p, ready: true };
    case "show-choices":
      return p.choicesVisible ? p : { ...p, choicesVisible: true, cueSpent: true };
  }
}

/** The mid-segment choice cue should fire now. */
export function cueDue(p: Playback, node: ShowNode, t: number): boolean {
  return !p.cueSpent && typeof node.showChoicesAt === "number" && t >= node.showChoicesAt;
}

/** An ENDED event from YouTube is the segment's real end: the segment has started, and when it
 * has an `end`, the clock is near it (seekTo from ENDED can re-fire ENDED at the old time). */
export function endIsReal(p: Playback, node: ShowNode | undefined, t: number | null): boolean {
  if (!p.ready) return false;
  return !(node && typeof node.end === "number" && t !== null && Math.abs(t - node.end) > 5);
}

/** The clock has sailed past `end` without YouTube firing ENDED. */
export function pastEnd(node: ShowNode, t: number): boolean {
  return typeof node.end === "number" && t >= node.end + END_BACKSTOP_TOLERANCE;
}
