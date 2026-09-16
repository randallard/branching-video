/**
 * Canonical JSON and a stable content hash — the basis of the idempotent snapshot id in
 * ADR-0011: importing the same content twice must produce the same event id, on any device, so
 * the second import is a no-op rather than a duplicate snapshot.
 *
 * "Canonical" here means object keys sorted and `undefined` dropped, so two objects that differ
 * only in key order hash the same. Both are pure, with no clock and no crypto, so the core stays
 * synchronous and testable.
 */
import { isRecord } from "./config.ts";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = canonicalize(value[key]);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  return value;
}

/** JSON text with every object's keys in sorted order. */
export function canonicalJson(value: unknown): string {
  // `JSON.stringify` is typed as returning `string`, but hands back `undefined` for values it
  // cannot represent (`undefined` itself, a function). Those are not JSON, so they hash as null.
  const json: unknown = JSON.stringify(canonicalize(value));
  return typeof json === "string" ? json : "null";
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

/** FNV-1a, 64 bits, as 16 hex characters. Not a security hash — it only has to be stable across
 * devices and builds, and unlikely to collide across one person's shows. */
export function stableHash(text: string): string {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    h = ((h ^ BigInt(text.charCodeAt(i))) * FNV_PRIME) & MASK64;
  }
  return h.toString(16).padStart(16, "0");
}

/** Content hash of any JSON-shaped value, independent of key order. */
export function contentHash(value: unknown): string {
  return stableHash(canonicalJson(value));
}
