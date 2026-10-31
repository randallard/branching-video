/**
 * The player's chapter menu, grouped. A show that mixes main nodes with asides lists them under
 * "Main chapters" and "Deep dives" so the asides don't clutter the main line; a show with only
 * one kind stays a single flat list. Config order is kept within each group.
 */
import type { ShowNode } from "./config.ts";

export interface MenuSection {
  heading: string | undefined;
  nodes: ShowNode[];
}

export function menuSections(nodes: readonly ShowNode[]): MenuSection[] {
  const main = nodes.filter((n) => n.isAside !== true);
  const asides = nodes.filter((n) => n.isAside === true);
  if (main.length === 0 || asides.length === 0) return [{ heading: undefined, nodes: [...nodes] }];
  return [
    { heading: "Main chapters", nodes: main },
    { heading: "Deep dives", nodes: asides },
  ];
}
