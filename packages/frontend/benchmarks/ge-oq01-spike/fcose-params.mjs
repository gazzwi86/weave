// fcose param provenance for TASK-001 (GE-EPIC-001 OQ-01 benchmark)
// ---------------------------------------------------------------------------
// The task brief and graph-explorer.md both cite `prototype-findings.md` as
// the source of the "prototype-tuned" fcose params, with an explicit warning
// that any deviation invalidates the benchmark comparison. That file does not
// exist anywhere in this repo -- see the escalation note at
// .claude/state/escalations/TASK-001-blocker.md.
//
// Per Engineer Law 12 ("never read files from prototype/") this harness does
// not itself read prototypes/weave-prototype/. The coordinator resolved the
// escalation by reading it under coordinator authority and handing back the
// exact values below, sourced to:
//   prototypes/weave-prototype/frontend/src/lib/cytoscape.ts, lines 106-114
// (recovered by coordinator, prototype-findings.md missing -- not
// independently verified against the source file by the Engineer, per Law 12).
//
// Only the 7 keys the prototype actually overrides are set here; every other
// fcose option is left at the library's own default (cytoscape-fcose already
// applies those when a key is omitted -- no need to restate them).
export const FCOSE_PARAMS = Object.freeze({
  name: "fcose",
  quality: "default",
  animate: true,
  animationDuration: 600,
  randomize: true,
  nodeSeparation: 90,
  idealEdgeLength: 110,
  nodeRepulsion: 6500,
});
