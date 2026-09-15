/**
 * The show config model — the single-show JSON format documented in README.md and frozen as
 * the publish/interchange format by ADR-0010.
 *
 * Files arrive as untrusted JSON (hand-written, exported by older builds, or saved drafts), so
 * `normalizeConfig` turns `unknown` into this shape leniently: a value of the wrong type is
 * treated as absent rather than rejected, which is how the pre-TypeScript pages effectively
 * behaved. Rejecting bad values is `validate`'s job, and it works on the raw input instead.
 */

export interface EndLink {
  label: string;
  target?: string | undefined;
  url?: string | undefined;
}

export interface EndScreen {
  heading?: string | undefined;
  body?: string | undefined;
  links: EndLink[];
}

export interface Choice {
  label: string;
  target: string;
  default?: boolean | undefined;
  style?: string | undefined;
}

export interface ShowNode {
  id: string;
  title: string;
  videoId?: string | undefined;
  start?: number | undefined;
  end?: number | undefined;
  showChoicesAt?: number | undefined;
  isAside?: boolean | undefined;
  defaultAside?: boolean | undefined;
  returnAtCurrentTime?: boolean | undefined;
  returnTo?: string | undefined;
  endScreen?: EndScreen | undefined;
  choices: Choice[];
}

export interface ShowConfig {
  title: string;
  startNode: string;
  choiceDisplaySeconds?: number | undefined;
  masterVideoId?: string | undefined;
  nodes: ShowNode[];
}

export type JsonRecord = Record<string, unknown>;

export function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function records(v: unknown): JsonRecord[] {
  return Array.isArray(v) ? v.filter(isRecord) : [];
}

function normalizeLink(l: JsonRecord): EndLink {
  const link: EndLink = { label: str(l["label"]) ?? "" };
  const target = str(l["target"]);
  const url = str(l["url"]);
  if (target !== undefined) link.target = target;
  if (url !== undefined) link.url = url;
  return link;
}

function normalizeChoice(c: JsonRecord): Choice {
  const choice: Choice = {
    label: str(c["label"]) ?? "",
    target: str(c["target"]) ?? "",
  };
  if (c["default"] === true) choice.default = true;
  const style = str(c["style"]);
  if (style !== undefined) choice.style = style;
  return choice;
}

export function normalizeNode(n: JsonRecord): ShowNode {
  const node: ShowNode = {
    id: str(n["id"]) ?? "",
    title: str(n["title"]) ?? "",
    choices: records(n["choices"]).map(normalizeChoice),
  };
  const videoId = str(n["videoId"]);
  if (videoId !== undefined) node.videoId = videoId;
  const start = num(n["start"]);
  if (start !== undefined) node.start = start;
  const end = num(n["end"]);
  if (end !== undefined) node.end = end;
  const showChoicesAt = num(n["showChoicesAt"]);
  if (showChoicesAt !== undefined) node.showChoicesAt = showChoicesAt;
  if (n["isAside"] === true) node.isAside = true;
  if (n["defaultAside"] === true) node.defaultAside = true;
  if (n["returnAtCurrentTime"] === true) node.returnAtCurrentTime = true;
  const returnTo = str(n["returnTo"]);
  if (returnTo !== undefined) node.returnTo = returnTo;
  const es = n["endScreen"];
  if (isRecord(es)) {
    const endScreen: EndScreen = { links: records(es["links"]).map(normalizeLink) };
    const heading = str(es["heading"]);
    const body = str(es["body"]);
    if (heading !== undefined) endScreen.heading = heading;
    if (body !== undefined) endScreen.body = body;
    node.endScreen = endScreen;
  }
  return node;
}

/** Lenient parse of a show config. `null` only when the input has no `nodes` array at all —
 * the one thing every page needs in order to do anything. */
export function normalizeConfig(raw: unknown): ShowConfig | null {
  if (!isRecord(raw) || !Array.isArray(raw["nodes"])) return null;
  const config: ShowConfig = {
    title: str(raw["title"]) ?? "",
    startNode: str(raw["startNode"]) ?? "",
    nodes: records(raw["nodes"]).map(normalizeNode),
  };
  const cds = num(raw["choiceDisplaySeconds"]);
  if (cds !== undefined) config.choiceDisplaySeconds = cds;
  const master = str(raw["masterVideoId"]);
  if (master !== undefined) config.masterVideoId = master;
  return config;
}

/** The legacy multi-draft backup written by the pre-event-log "Export All" (ADR-0001). */
export const LEGACY_BACKUP_TYPE = "bvp-backup";

export function isLegacyBackup(raw: unknown): boolean {
  return isRecord(raw) && raw["type"] === LEGACY_BACKUP_TYPE;
}
