/**
 * Validation rules for show configs, shared by the CLI (`pnpm validate`) and the Editor's live
 * panel so the rules never drift. Ported from `tools/validate-core.js`.
 *
 * Works on the *raw* parsed JSON, not the normalized model: its job is to report values of the
 * wrong type, which normalization would silently drop. Never throws, whatever the input.
 */
import { isRecord } from "./config.ts";
import type { JsonRecord } from "./config.ts";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  nodeCount: number;
  uniqueIds: number;
}

/** Mirror the player's behaviour: ignore underscore-prefixed annotation fields. */
export function stripUnderscores(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnderscores);
  if (isRecord(value)) {
    const out: JsonRecord = {};
    for (const [k, v] of Object.entries(value)) {
      if (!k.startsWith("_")) out[k] = stripUnderscores(v);
    }
    return out;
  }
  return value;
}

const truthy = (v: unknown): boolean => Boolean(v);
const show = (v: unknown): string =>
  typeof v === "string" ? v : v === undefined ? "undefined" : JSON.stringify(v);

function asRecords(v: unknown): JsonRecord[] {
  return Array.isArray(v) ? v.map((x) => (isRecord(x) ? x : {})) : [];
}

function linksOf(n: JsonRecord): JsonRecord[] | null {
  const es = n["endScreen"];
  if (!isRecord(es) || !Array.isArray(es["links"])) return null;
  return asRecords(es["links"]);
}

export function validate(rawConfig: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (msg: string): void => {
    errors.push(msg);
  };
  const warn = (msg: string): void => {
    warnings.push(msg);
  };

  const stripped = stripUnderscores(rawConfig);
  const config: JsonRecord = isRecord(stripped) ? stripped : {};
  const nodesRaw = config["nodes"];
  const nodes = asRecords(nodesRaw);
  const startNode = config["startNode"];

  if (!Array.isArray(nodesRaw) || nodesRaw.length === 0) {
    err('Config must have a non-empty "nodes" array.');
  }
  if (!truthy(startNode)) {
    err('Config must define "startNode".');
  }

  const nodeMap = new Map<string, JsonRecord>();
  const seenIds = new Set<string>();
  const key = (v: unknown): string => show(v);

  nodes.forEach((n, i) => {
    const ctx = `nodes[${String(i)}]`;
    const id = n["id"];
    if (!truthy(id)) {
      err(`${ctx}: missing "id"`);
      return;
    }
    const idStr = key(id);
    if (seenIds.has(idStr)) err(`${ctx}: duplicate id "${idStr}"`);
    seenIds.add(idStr);
    nodeMap.set(idStr, n);

    if (!truthy(n["videoId"]) && !truthy(config["masterVideoId"])) {
      err(`node "${idStr}": no "videoId" and no top-level "masterVideoId" set`);
    }

    const start = n["start"];
    const end = n["end"];
    if (start != null && (typeof start !== "number" || start < 0)) {
      err(`node "${idStr}": "start" must be a non-negative number`);
    }
    if (end != null && (typeof end !== "number" || end <= 0)) {
      err(`node "${idStr}": "end" must be a positive number`);
    }
    if (typeof start === "number" && typeof end === "number" && start >= end) {
      err(`node "${idStr}": "start" (${String(start)}) must be less than "end" (${String(end)})`);
    }

    const sca = n["showChoicesAt"];
    if (sca != null) {
      if (typeof sca !== "number") {
        err(`node "${idStr}": "showChoicesAt" must be a number (seconds)`);
      } else {
        const lo = start ?? 0;
        if (typeof lo === "number" && sca < lo) {
          err(`node "${idStr}": "showChoicesAt" (${String(sca)}) is before "start" (${String(lo)})`);
        }
        if (typeof end === "number" && sca >= end) {
          err(`node "${idStr}": "showChoicesAt" (${String(sca)}) is at or after "end" (${String(end)})`);
        }
      }
    }

    let defaultCount = 0;
    const choices = asRecords(n["choices"]);
    choices.forEach((c, j) => {
      const cctx = `node "${idStr}" choices[${String(j)}]`;
      if (!truthy(c["label"])) err(`${cctx}: missing "label"`);
      if (!truthy(c["target"])) err(`${cctx}: missing "target"`);
      if (truthy(c["default"])) defaultCount++;
      const style = c["style"];
      if (truthy(style) && style !== "primary" && style !== "secondary") {
        warn(`${cctx}: unknown style "${show(style)}" (expected "primary" or "secondary")`);
      }
    });
    if (defaultCount > 1) {
      err(`node "${idStr}": ${String(defaultCount)} choices marked default — only one allowed`);
    }
    if (choices.length > 0 && defaultCount === 0 && !truthy(n["isAside"])) {
      warn(`node "${idStr}": no default choice — countdown will not auto-advance`);
    }
  });

  const has = (v: unknown): boolean => truthy(v) && nodeMap.has(key(v));

  if (truthy(startNode) && !has(startNode)) {
    err(`"startNode" points to unknown node "${show(startNode)}"`);
  }

  for (const n of nodes) {
    const idStr = show(n["id"]);
    for (const c of asRecords(n["choices"])) {
      if (truthy(c["target"]) && !has(c["target"])) {
        const label = truthy(c["label"]) ? show(c["label"]) : "(unlabeled)";
        err(`node "${idStr}" choice "${label}": target "${show(c["target"])}" not found`);
      }
    }
    if (truthy(n["returnTo"]) && !has(n["returnTo"])) {
      err(`node "${idStr}": returnTo "${show(n["returnTo"])}" not found`);
    }
    for (const link of linksOf(n) ?? []) {
      if (truthy(link["target"]) && !has(link["target"])) {
        const label = truthy(link["label"]) ? show(link["label"]) : "(unlabeled)";
        err(`node "${idStr}" endScreen link "${label}": target "${show(link["target"])}" not found`);
      }
    }
    if (truthy(n["defaultAside"]) && !truthy(n["returnTo"])) {
      err(`node "${idStr}": defaultAside requires "returnTo"`);
    }
    if (truthy(n["returnAtCurrentTime"]) && !truthy(n["isAside"])) {
      warn(`node "${idStr}": "returnAtCurrentTime" is set but node is not marked isAside — the resume button will not appear`);
    }
    if (truthy(n["returnAtCurrentTime"]) && !truthy(n["returnTo"])) {
      warn(`node "${idStr}": "returnAtCurrentTime" without "returnTo" — deep-linking directly to this node will leave it with no exit path`);
    }
  }

  if (has(startNode)) {
    const reachable = new Set<string>();
    const queue: string[] = [key(startNode)];
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      if (reachable.has(id)) continue;
      reachable.add(id);
      const n = nodeMap.get(id);
      if (!n) continue;
      for (const c of asRecords(n["choices"])) {
        if (has(c["target"])) queue.push(key(c["target"]));
      }
      if (has(n["returnTo"])) queue.push(key(n["returnTo"]));
      for (const link of linksOf(n) ?? []) {
        if (has(link["target"])) queue.push(key(link["target"]));
      }
    }
    for (const n of nodes) {
      const idStr = show(n["id"]);
      if (!reachable.has(idStr)) {
        warn(`node "${idStr}" is unreachable from startNode "${show(startNode)}"`);
      }
    }
  }

  for (const n of nodes) {
    const hasChoices = asRecords(n["choices"]).length > 0;
    if (!hasChoices && !truthy(n["returnTo"]) && !truthy(n["endScreen"])) {
      warn(`node "${show(n["id"])}" is a dead end (no choices, no returnTo, no endScreen) — viewer will see generic "Watch again" screen`);
    }
  }

  return { errors, warnings, nodeCount: nodes.length, uniqueIds: seenIds.size };
}
