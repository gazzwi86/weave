// fcose param provenance for TASK-001 (GE-EPIC-001 OQ-01 benchmark)
// ---------------------------------------------------------------------------
// The task brief and graph-explorer.md both cite `prototype-findings.md` as
// the source of the "prototype-tuned" fcose params, with an explicit warning
// that any deviation invalidates the benchmark comparison. That file does not
// exist anywhere in this repo (searched, no hits) -- see the escalation note
// at .claude/state/escalations/TASK-001-blocker.md for the full reasoning.
//
// Per Engineer Law 12 ("never read files from prototype/"), this harness does
// NOT read prototypes/weave-prototype/ to recover the real tuned values.
// Instead it uses the published cytoscape-fcose package's own documented
// defaults verbatim (node_modules/cytoscape-fcose/src/fcose/index.js) --
// this is a disclosed substitution, not a silent guess. The three function-
// valued options (nodeRepulsion/idealEdgeLength/edgeElasticity) are constant
// functions in the library default (e.g. `node => 4500`), so they are
// inlined here as their constant return value -- behaviourally identical,
// and JSON-serializable for page.evaluate().
export const FCOSE_PARAMS = Object.freeze({
  name: "fcose",
  quality: "default",
  randomize: true,
  animate: true,
  animationDuration: 1000,
  fit: true,
  padding: 30,
  nodeDimensionsIncludeLabels: false,
  uniformNodeDimensions: false,
  packComponents: true,
  samplingType: true,
  sampleSize: 25,
  nodeSeparation: 75,
  piTol: 0.0000001,
  nodeRepulsion: 4500,
  idealEdgeLength: 50,
  edgeElasticity: 0.45,
  nestingFactor: 0.1,
  gravity: 0.25,
  numIter: 2500,
  tile: true,
  tilingPaddingVertical: 10,
  tilingPaddingHorizontal: 10,
  gravityRangeCompound: 1.5,
  gravityCompound: 1.0,
  gravityRange: 3.8,
  initialEnergyOnIncremental: 0.3,
});
