#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { validate } = require('./validate-core.js');

const configPath = process.argv[2] || 'config.json';

let raw;
try {
  raw = fs.readFileSync(configPath, 'utf8');
} catch (e) {
  console.error(`Cannot read ${configPath}: ${e.message}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(raw);
} catch (e) {
  console.error(`Invalid JSON in ${configPath}: ${e.message}`);
  process.exit(1);
}

const { errors, warnings, nodeCount, uniqueIds } = validate(config);

if (warnings.length) {
  console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.log(`  - ${e}`);
  console.log('');
  process.exit(1);
}

console.log(`\nOK: ${configPath} is valid (${nodeCount} nodes, ${uniqueIds} unique ids).`);
process.exit(0);
