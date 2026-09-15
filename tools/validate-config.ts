// `pnpm validate <file>` — check a show config for broken graphs before publishing it.
// Runs directly under Node's type stripping (Node >= 22.18); the rules live in src/core.
import { readFileSync } from "node:fs";
import { validate } from "../src/core/validate.ts";

const configPath = process.argv[2] ?? "public/config.json";

let raw: string;
try {
  raw = readFileSync(configPath, "utf8");
} catch (e) {
  console.error(`Cannot read ${configPath}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

let config: unknown;
try {
  config = JSON.parse(raw);
} catch (e) {
  console.error(`Invalid JSON in ${configPath}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

const { errors, warnings, nodeCount, uniqueIds } = validate(config);
const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

if (warnings.length) {
  console.log(`\n${plural(warnings.length, "warning")}:`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`\n${plural(errors.length, "error")}:`);
  for (const e of errors) console.log(`  - ${e}`);
  console.log("");
  process.exit(1);
}

console.log(`\nOK: ${configPath} is valid (${String(nodeCount)} nodes, ${String(uniqueIds)} unique ids).`);
