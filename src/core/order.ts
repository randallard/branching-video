/**
 * Fractional order keys for the node list (ADR-0008).
 *
 * A node carries a sortable `order` string rather than an index into an array, so two devices
 * that each insert a node keep both instead of fighting over one order array. Keys are compared
 * as plain strings, which is why the alphabet is in ASCII order.
 *
 * A key is read as the digits after an implicit "0." in base 62. `""` is below every key, and
 * `null` as an upper bound means "past the end". Generated keys never end in the lowest digit,
 * because `"1"` and `"10"` are the same number and only one of them can be the key.
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;

function digitValue(c: string): number {
  const i = DIGITS.indexOf(c);
  if (i < 0) throw new Error(`not an order key digit: ${JSON.stringify(c)}`);
  return i;
}

function digit(i: number): string {
  const c = DIGITS[i];
  if (c === undefined) throw new Error(`order digit out of range: ${String(i)}`);
  return c;
}

/**
 * A key strictly between `a` and `b`. `a` may be `""` (start of the list) and `b` may be `null`
 * (end of the list); otherwise `a < b` is required, which is the caller's job to arrange.
 */
export function orderBetween(a: string | null, b: string | null): string {
  const lo = a ?? "";
  if (b !== null && lo >= b) {
    throw new Error(`order keys out of sequence: ${JSON.stringify(lo)} >= ${JSON.stringify(b)}`);
  }

  // Share whatever prefix the bounds agree on, then solve the shorter problem below it. `a` is
  // padded with the lowest digit because a missing digit *is* the lowest digit.
  if (b !== null) {
    let n = 0;
    while (n < b.length && (lo[n] ?? DIGITS[0]) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + orderBetween(lo.slice(n), b.slice(n));
  }

  const da = lo === "" ? 0 : digitValue(lo.charAt(0));
  const db = b === null ? BASE : digitValue(b.charAt(0));

  // Room for a digit of our own between them.
  if (db - da > 1) return digit(Math.floor((da + db) / 2));

  // Adjacent digits: keep `a`'s and go one place deeper, where the whole range is free.
  return digit(da) + orderBetween(lo.slice(1), null);
}

/**
 * `n` keys in ascending order, for laying out a node list that has none yet (a snapshot, or a
 * config imported from a file). Spread across the alphabet rather than appended one by one, so a
 * list of any normal size gets single-digit keys and later inserts have room on both sides.
 */
export function orderKeys(n: number): string[] {
  if (n <= 0) return [];
  const step = Math.floor(BASE / (n + 1));
  if (step >= 1) {
    return Array.from({ length: n }, (_, i) => digit(step * (i + 1)));
  }
  // More nodes than digits: fall back to appending, which grows the keys but always works.
  const keys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    prev = orderBetween(prev, null);
    keys.push(prev);
  }
  return keys;
}
