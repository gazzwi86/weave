#!/usr/bin/env node
/* Validates the Versent graph data in versent-ai-first-network.html.
   Warnings only (exit 0) so it never blocks an edit. Wired as a PostToolUse hook
   in .claude/settings.json; also usable as a git pre-commit hook. */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'versent-ai-first-network.html');
let h;
try { h = fs.readFileSync(FILE, 'utf8'); } catch { process.exit(0); }

const block = name => {
  const m = h.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
  return m ? m[1] : '';
};
const nodeBlock = block('NODES');
const edgeBlock = block('EDGES');
if (!nodeBlock || !edgeBlock) process.exit(0);

const ids = [...nodeBlock.matchAll(/id:'([a-z0-9_]+)'/g)].map(m => m[1]);
const idset = new Set(ids);
const edges = [...edgeBlock.matchAll(/\['([a-z0-9_]+)','([a-z0-9_]+)','([a-z-]+)'\]/g)].map(m => [m[1], m[2], m[3]]);
const classes = new Set([...((h.match(/const CLS = \{([\s\S]*?)\};/) || [, ''])[1]).matchAll(/^\s*([a-z]+)\s*:/gm)].map(m => m[1]));
const verbs = new Set([...((h.match(/const EDGE_TYPES = \{([\s\S]*?)\};/) || [, ''])[1]).matchAll(/'([a-z-]+)':/g)].map(m => m[1]));

const issues = [];
[...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))].forEach(d => issues.push(`duplicate node id: ${d}`));
[...new Set([...nodeBlock.matchAll(/cls:'([a-z]+)'/g)].map(m => m[1]))].forEach(c => { if (!classes.has(c)) issues.push(`unknown node class: ${c}`); });
const seen = new Set(), conn = new Set();
edges.forEach(e => {
  if (!idset.has(e[0]) || !idset.has(e[1])) issues.push(`dangling edge [${e.join(',')}]`);
  if (!verbs.has(e[2])) issues.push(`unknown verb in [${e.join(',')}]`);
  const k = e.join('>'); if (seen.has(k)) issues.push(`duplicate edge: ${k}`); seen.add(k);
  conn.add(e[0]); conn.add(e[1]);
});
ids.forEach(id => { if (!conn.has(id)) issues.push(`orphan node (no edges): ${id}`); });

// --- parity: contribute.html DIR must mirror the graph's NODES (id/label/cls) ---
const htmlNodes = new Map(
  [...nodeBlock.matchAll(/id:'([a-z0-9_]+)',\s*label:'([^']*)',\s*cls:'([a-z]+)'/g)]
    .map(m => [m[1], { label: m[2], cls: m[3] }])
);
const CONTRIB = path.join(__dirname, '..', 'contribute.html');
let dirRaw = '';
try { dirRaw = fs.readFileSync(CONTRIB, 'utf8'); } catch {}
if (dirRaw) {
  const dirBlock = (dirRaw.match(/const DIR = \[([\s\S]*?)\];/) || [, ''])[1];
  const dir = new Map(
    [...dirBlock.matchAll(/\{id:"([a-z0-9_]+)",label:"([^"]*)",cls:"([a-z]+)"\}/g)]
      .map(m => [m[1], { label: m[2], cls: m[3] }])
  );
  htmlNodes.forEach((v, id) => {
    const d = dir.get(id);
    if (!d) issues.push(`contribute.html DIR missing node: ${id}`);
    else if (d.label !== v.label || d.cls !== v.cls) issues.push(`contribute.html DIR drift for ${id} (label/cls differs)`);
  });
  dir.forEach((_v, id) => { if (!htmlNodes.has(id)) issues.push(`contribute.html DIR has stale node: ${id}`); });
}

if (issues.length) {
  console.error(`⚠ versent graph: ${issues.length} issue(s):\n - ${issues.join('\n - ')}`);
} else {
  console.log(`✓ versent graph OK: ${ids.length} nodes, ${edges.length} edges.`);
}
process.exit(0);
