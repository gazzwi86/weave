// THROWAWAY spike fixture generator for TASK-001 (GE-EPIC-001 OQ-01 benchmark).
// Produces synthetic graphs matching the CE-READ-1 SPARQL SELECT row shape
// (node_iri, bpmo_kind, label / source_iri, target_iri, predicate), converted
// to Cytoscape element JSON so the harness page can load them directly.
//
// ponytail: no seeded RNG -- run-to-run fixture content varies slightly, but
// node/edge *counts* are deterministic (what the benchmark actually gates on).
// Add a seed if exact reproducibility of node placement is ever needed.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KINDS = ["Process", "Actor", "System", "DataObject", "Rule", "Event", "Outcome", "Domain"];
const EDGES_PER_NODE = 3;

function generateFixture(size) {
  const nodes = Array.from({ length: size }, (_, i) => ({
    data: {
      id: `n${i}`,
      node_iri: `urn:weave:bench:node:${i}`,
      bpmo_kind: KINDS[i % KINDS.length],
      label: `Node ${i}`,
    },
  }));

  const edges = [];
  for (let i = 0; i < size; i++) {
    for (let e = 0; e < EDGES_PER_NODE; e++) {
      const target = Math.floor(Math.random() * size);
      if (target === i) continue;
      edges.push({
        data: {
          id: `e${i}_${e}`,
          source: `n${i}`,
          target: `n${target}`,
          predicate: "weave:relatesTo",
        },
      });
    }
  }

  return { elements: { nodes, edges } };
}

const outDir = join(dirname(fileURLToPath(import.meta.url)));
mkdirSync(outDir, { recursive: true });

for (const size of [1000, 5000, 10000]) {
  const fixture = generateFixture(size);
  writeFileSync(join(outDir, `${size}.json`), JSON.stringify(fixture));
  console.log(`wrote ${size}.json: ${fixture.elements.nodes.length} nodes, ${fixture.elements.edges.length} edges`);
}
