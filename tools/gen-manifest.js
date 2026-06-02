#!/usr/bin/env node
'use strict';

// Writes live/manifest.json — the list of show configs in live/ — so index.html
// can list them on GitHub Pages, which has no directory listing. Run after
// adding or removing a config: `pnpm manifest` (or `node tools/gen-manifest.js`).

const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'live';
const out = path.join(dir, 'manifest.json');

let entries;
try {
  entries = fs.readdirSync(dir);
} catch (e) {
  console.error(`Cannot read ${dir}/: ${e.message}`);
  process.exit(1);
}

const files = entries
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .sort((a, b) => a.localeCompare(b));

const shows = files.map(file => {
  let title = file;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (cfg && typeof cfg.title === 'string' && cfg.title.trim()) title = cfg.title;
  } catch (_) { /* keep filename as the title */ }
  return { file, title };
});

fs.writeFileSync(out, JSON.stringify(shows, null, 2) + '\n');
console.log(`Wrote ${out} (${shows.length} show${shows.length === 1 ? '' : 's'}).`);
