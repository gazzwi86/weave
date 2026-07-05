/** fcose layout params, copied verbatim from the TASK-001 benchmark spike
 * (packages/frontend/benchmarks/ge-oq01-spike/fcose-params.mjs), sourced to
 * prototypes/weave-prototype/frontend/src/lib/cytoscape.ts lines 106-114.
 * Do not tune here -- ADR-001 pins these for the bounded M1 canvas. */
export const FCOSE_PARAMS = Object.freeze({
  quality: "default",
  animate: true,
  animationDuration: 600,
  randomize: true,
  nodeSeparation: 90,
  idealEdgeLength: 110,
  nodeRepulsion: 6500,
});
