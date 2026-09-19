/**
 * Clean JSON output for export, transfer between pages, and validation.
 *
 * Studio and Editor serialized slightly differently through slice 2 (ADR-0003 ported behaviour
 * unchanged); slice 3b.3 unifies them into one `serialize()`. `choiceDisplaySeconds` is always
 * written, defaulting to 8 (Studio's old behaviour) — cosmetic only, since the player already
 * treats a missing value as 8. `endScreen` links are always normalized to exactly one of `url`/
 * `target` (Editor's old, stricter behaviour).
 */
import type { Choice, EndScreen, ShowConfig, ShowNode } from "./config.ts";

function serializeChoice(c: Choice): Choice {
  const out: Choice = { label: c.label || "", target: c.target || "" };
  if (c.default) out.default = true;
  if (c.style) out.style = c.style;
  return out;
}

function nodeCommon(n: ShowNode): ShowNode {
  const o: ShowNode = { id: n.id, title: n.title || "", choices: [] };
  if (n.videoId) o.videoId = n.videoId;
  if (typeof n.start === "number") o.start = n.start;
  if (typeof n.end === "number") o.end = n.end;
  if (typeof n.showChoicesAt === "number") o.showChoicesAt = n.showChoicesAt;
  if (n.isAside) o.isAside = true;
  if (n.defaultAside) o.defaultAside = true;
  if (n.returnAtCurrentTime) o.returnAtCurrentTime = true;
  if (n.returnTo) o.returnTo = n.returnTo;
  return o;
}

function serializeEndScreen(es: EndScreen): EndScreen {
  const out: EndScreen = { links: [] };
  if (es.heading) out.heading = es.heading;
  if (es.body) out.body = es.body;
  out.links = es.links.map((l) => {
    const lo: EndScreen["links"][number] = { label: l.label || "" };
    if (l.url) lo.url = l.url;
    else if (l.target) lo.target = l.target;
    return lo;
  });
  return out;
}

export function serialize(config: ShowConfig): ShowConfig {
  const out: ShowConfig = {
    title: config.title || "",
    startNode: config.startNode || "",
    choiceDisplaySeconds: config.choiceDisplaySeconds ?? 8,
    nodes: [],
  };
  if (config.masterVideoId) out.masterVideoId = config.masterVideoId;
  out.nodes = config.nodes.map((n) => {
    const o = nodeCommon(n);
    o.choices = n.choices.map(serializeChoice);
    if (n.endScreen) o.endScreen = serializeEndScreen(n.endScreen);
    return o;
  });
  return out;
}

/** Two-space JSON with a trailing newline — the on-disk form of an exported show. */
export function toFileText(config: ShowConfig): string {
  return JSON.stringify(config, null, 2) + "\n";
}
