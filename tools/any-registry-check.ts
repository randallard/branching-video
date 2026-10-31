/**
 * The `any` registry check (ADR-0032). Every `any`, and every type assertion other than
 * `as const`, in `src/` must be listed in `docs/any-registry.md`, with the count per file
 * matching, and carry a `// cast (any-registry): …` comment just above it. Reads the TypeScript
 * syntax tree, so comments and strings that happen to contain " as " don't count.
 *
 *   node tools/any-registry-check.ts          # check; exit 1 on any mismatch
 *   node tools/any-registry-check.ts --list   # print every cast with its line
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const root = join(import.meta.dirname, "..");
const REGISTRY = join(root, "docs", "any-registry.md");

interface Cast {
  file: string;
  line: number;
  text: string;
  /** Whether a `// cast (any-registry): …` comment sits in the few lines above it. */
  justified: boolean;
}

const MARKER = "cast (any-registry):";
/** How far above a cast its justification may start (a long reason wraps over lines). */
const LOOKBACK = 6;

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return name.endsWith(".ts") ? [path] : [];
  });
}

function isAsConst(node: ts.AsExpression): boolean {
  return ts.isTypeReferenceNode(node.type) && node.type.typeName.getText() === "const";
}

function castsIn(path: string): Cast[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const file = relative(root, path);
  const found: Cast[] = [];
  const visit = (node: ts.Node): void => {
    // `x as unknown as T` is one cast: count the outer assertion, not the inner step.
    const innerOfDouble = ts.isAsExpression(node) && ts.isAsExpression(node.parent);
    const isCast =
      (ts.isAsExpression(node) && !isAsConst(node) && !innerOfDouble) ||
      ts.isTypeAssertionExpression(node) ||
      node.kind === ts.SyntaxKind.AnyKeyword;
    if (isCast) {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const above = lines.slice(Math.max(0, line - 1 - LOOKBACK), line - 1);
      found.push({
        file,
        line,
        text: node.getText().replace(/\s+/g, " ").slice(0, 90),
        justified: above.some((l) => l.includes(MARKER)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Registry rows: `| \`path\` | count | ... |`. */
function registered(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of readFileSync(REGISTRY, "utf8").split("\n")) {
    const m = /^\| `([^`]+\.ts)` \| (\d+) \|/.exec(line);
    if (m?.[1] !== undefined && m[2] !== undefined) counts.set(m[1], Number(m[2]));
  }
  return counts;
}

const casts = tsFiles(join(root, "src")).flatMap(castsIn);

if (process.argv.includes("--list")) {
  for (const c of casts) console.log(`${c.file}:${String(c.line)}  ${c.text}`);
  process.exit(0);
}

const actual = new Map<string, number>();
for (const c of casts) actual.set(c.file, (actual.get(c.file) ?? 0) + 1);
const expected = registered();
const problems: string[] = [];
for (const file of new Set([...actual.keys(), ...expected.keys()])) {
  const a = actual.get(file) ?? 0;
  const e = expected.get(file) ?? 0;
  if (a !== e) {
    const lines = casts.filter((c) => c.file === file).map((c) => c.line);
    problems.push(`${file}: ${String(a)} cast(s) in the code, ${String(e)} in the registry (lines ${lines.join(", ") || "none"})`);
  }
}
for (const c of casts.filter((x) => !x.justified)) {
  problems.push(`${c.file}:${String(c.line)}: no "// ${MARKER} …" comment above \`${c.text}\``);
}
if (problems.length > 0) {
  console.error("any registry out of date (docs/any-registry.md, ADR-0032):");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`any registry matches: ${String(casts.length)} cast(s) in ${String(actual.size)} file(s)`);
