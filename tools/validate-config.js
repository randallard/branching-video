#!/usr/bin/env node
'use strict';

const fs = require('fs');

const configPath = process.argv[2] || 'config.json';

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

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

// Mirror the player's behavior: ignore underscore-prefixed annotation fields.
function stripUnderscores(obj) {
  if (Array.isArray(obj)) return obj.map(stripUnderscores);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) {
      if (!k.startsWith('_')) out[k] = stripUnderscores(obj[k]);
    }
    return out;
  }
  return obj;
}
config = stripUnderscores(config);

if (!Array.isArray(config.nodes) || config.nodes.length === 0) {
  err('Config must have a non-empty "nodes" array.');
}
if (!config.startNode) {
  err('Config must define "startNode".');
}

const nodeMap = {};
const seenIds = new Set();

for (let i = 0; i < (config.nodes || []).length; i++) {
  const n = config.nodes[i];
  const ctx = `nodes[${i}]`;

  if (!n.id) {
    err(`${ctx}: missing "id"`);
    continue;
  }
  if (seenIds.has(n.id)) err(`${ctx}: duplicate id "${n.id}"`);
  seenIds.add(n.id);
  nodeMap[n.id] = n;

  if (!n.videoId && !config.masterVideoId) {
    err(`node "${n.id}": no "videoId" and no top-level "masterVideoId" set`);
  }

  if (n.start != null && (typeof n.start !== 'number' || n.start < 0)) {
    err(`node "${n.id}": "start" must be a non-negative number`);
  }
  if (n.end != null && (typeof n.end !== 'number' || n.end <= 0)) {
    err(`node "${n.id}": "end" must be a positive number`);
  }
  if (typeof n.start === 'number' && typeof n.end === 'number' && n.start >= n.end) {
    err(`node "${n.id}": "start" (${n.start}) must be less than "end" (${n.end})`);
  }

  if (n.showChoicesAt != null) {
    if (typeof n.showChoicesAt !== 'number') {
      err(`node "${n.id}": "showChoicesAt" must be a number (seconds)`);
    } else {
      const lo = n.start ?? 0;
      if (n.showChoicesAt < lo) {
        err(`node "${n.id}": "showChoicesAt" (${n.showChoicesAt}) is before "start" (${lo})`);
      }
      if (typeof n.end === 'number' && n.showChoicesAt >= n.end) {
        err(`node "${n.id}": "showChoicesAt" (${n.showChoicesAt}) is at or after "end" (${n.end})`);
      }
    }
  }

  let defaultCount = 0;
  for (let j = 0; j < (n.choices || []).length; j++) {
    const c = n.choices[j];
    const cctx = `node "${n.id}" choices[${j}]`;
    if (!c.label) err(`${cctx}: missing "label"`);
    if (!c.target) err(`${cctx}: missing "target"`);
    if (c.default) defaultCount++;
    if (c.style && c.style !== 'primary' && c.style !== 'secondary') {
      warn(`${cctx}: unknown style "${c.style}" (expected "primary" or "secondary")`);
    }
  }
  if (defaultCount > 1) {
    err(`node "${n.id}": ${defaultCount} choices marked default — only one allowed`);
  }
  if ((n.choices || []).length > 0 && defaultCount === 0 && !n.isAside) {
    warn(`node "${n.id}": no default choice — countdown will not auto-advance`);
  }
}

if (config.startNode && !nodeMap[config.startNode]) {
  err(`"startNode" points to unknown node "${config.startNode}"`);
}

for (const n of config.nodes || []) {
  for (const c of n.choices || []) {
    if (c.target && !nodeMap[c.target]) {
      err(`node "${n.id}" choice "${c.label || '(unlabeled)'}": target "${c.target}" not found`);
    }
  }
  if (n.returnTo && !nodeMap[n.returnTo]) {
    err(`node "${n.id}": returnTo "${n.returnTo}" not found`);
  }
  if (n.endScreen && Array.isArray(n.endScreen.links)) {
    for (const link of n.endScreen.links) {
      if (link.target && !nodeMap[link.target]) {
        err(`node "${n.id}" endScreen link "${link.label || '(unlabeled)'}": target "${link.target}" not found`);
      }
    }
  }
  if (n.defaultAside && !n.returnTo) {
    err(`node "${n.id}": defaultAside requires "returnTo"`);
  }
  if (n.returnAtCurrentTime && !n.isAside) {
    warn(`node "${n.id}": "returnAtCurrentTime" is set but node is not marked isAside — the resume button will not appear`);
  }
  if (n.returnAtCurrentTime && !n.returnTo) {
    warn(`node "${n.id}": "returnAtCurrentTime" without "returnTo" — deep-linking directly to this node will leave it with no exit path`);
  }
}

if (config.startNode && nodeMap[config.startNode]) {
  const reachable = new Set();
  const queue = [config.startNode];
  while (queue.length) {
    const id = queue.shift();
    if (reachable.has(id)) continue;
    reachable.add(id);
    const n = nodeMap[id];
    if (!n) continue;
    for (const c of n.choices || []) {
      if (c.target && nodeMap[c.target]) queue.push(c.target);
    }
    if (n.returnTo && nodeMap[n.returnTo]) queue.push(n.returnTo);
    if (n.endScreen && Array.isArray(n.endScreen.links)) {
      for (const link of n.endScreen.links) {
        if (link.target && nodeMap[link.target]) queue.push(link.target);
      }
    }
  }
  for (const n of config.nodes || []) {
    if (!reachable.has(n.id)) {
      warn(`node "${n.id}" is unreachable from startNode "${config.startNode}"`);
    }
  }
}

for (const n of config.nodes || []) {
  const hasChoices = (n.choices || []).length > 0;
  const hasReturn = !!n.returnTo;
  const hasEnd = !!n.endScreen;
  if (!hasChoices && !hasReturn && !hasEnd) {
    warn(`node "${n.id}" is a dead end (no choices, no returnTo, no endScreen) — viewer will see generic "Watch again" screen`);
  }
}

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

console.log(`\nOK: ${configPath} is valid (${(config.nodes || []).length} nodes, ${seenIds.size} unique ids).`);
process.exit(0);
