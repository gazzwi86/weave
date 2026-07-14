import { EDGEHANDLES_PARAMS } from "./edgehandles-params";
import { FCOSE_PARAMS } from "./fcose-params";
import type { HeatmapMapping } from "./overlays/heatmap-overlay";

/** Tunable Explorer canvas config (AC-2/AC-6: no magic numbers in
 * components -- every threshold/timeout routes through this object). */
export interface ExplorerConfig {
  /** AC-2: CE-READ-1 pagination deadline, ms. */
  ceTimeoutMs: number;
  /** AC-6: zoom below this hides node labels. */
  nodeLabelThreshold: number;
  /** AC-6: zoom below this hides edge labels. */
  edgeLabelThreshold: number;
  /** AC-1: opacity applied to non-neighbourhood elements when spotlighting. */
  spotlightDimOpacity: number;
  /** AC-6: duration of the centre-on-select animation, ms. */
  centreAnimationMs: number;
  /** TASK-004 AC-1/AC-2: backoff delays (ms) between save-position retries;
   * a non-blocking toast only appears once every delay is exhausted. */
  layoutSaveRetryDelaysMs: number[];
  /** TASK-004: fixed graph id for the M1 whole-company force canvas -- there
   * is no per-graph routing yet (single canvas, single graph). */
  layoutGraphId: string;
  /** TASK-005 AC-1 (SS-GE-4): predicate IRI CE uses for domain membership.
   * Lives here (config), never as a literal in a query-builder/logic file --
   * query builders receive it as a parameter. */
  domainMembershipPredicate: string;
  /** TASK-005 AC-4: neighbour count above which expand asks for confirmation
   * before mutating the canvas. */
  expandConfirmThreshold: number;
  /** TASK-005 AC-3: bpmoKind value that marks a node as a domain -- the
   * context menu only offers "Focus domain" when a node's kind matches this.
   * Lives here (not a literal in node-context-menu.tsx) so it can be
   * corrected without a code change if CE's ontology names it differently. */
  domainKind: string;
  fcoseParams: typeof FCOSE_PARAMS;
  /** TASK-023 AC-6: cytoscape-edgehandles params -- library defaults,
   * disclosed in ADR-022 (Law 12 blocks reading prototype/ for the
   * task brief's suggested prototype-ported values). */
  edgehandlesParams: typeof EDGEHANDLES_PARAMS;
  /** TASK-020 AC-6: governed-content layer membership -- kind local names
   * (matches node.data.bpmo_kind / rdf:type's WEAVE_ONTOLOGY_NS-relative
   * segment). Pinned by the task brief: Glossary = Concept, Governance =
   * Policy (+ governedByPredicate edges). brandLayerKind is tenant-
   * configured and empty by default -- a tenant with no Brand individuals
   * never had one set, which fetchLayerNodes already treats as an empty
   * layer (AC-6 disables the toggle, no special-casing needed). */
  glossaryLayerKind: string;
  governanceLayerKind: string;
  governanceLayerPredicate: string;
  brandLayerKind: string;
  /** TASK-021 AC-1/AC-6: grey fallback for a heatmap-overlay node with no
   * match on the active dimension. */
  heatNoneColour: string;
  /** TASK-021: grey fallback for a domain-colouring-overlay node with no
   * domain-membership edge -- reuses the kind-fallback token (same "no
   * data" grey already used elsewhere on the canvas). */
  domainNoneColour: string;
  /** TASK-021 AC-3: categorical series palette, cycled when there are more
   * domains than colours. */
  domainPalette: string[];
  /** TASK-021 Dependencies: prototype value->colour mappings, one entry per
   * heatmap dimension (maturity/investment/strategy/lifecycle -- the FR-015
   * dimension list is known structure, unlike the value vocab). Each
   * dimension's `values` map is empty here -- the brief's source file
   * (prototype-findings.md) isn't present in this worktree (flagged to
   * team-lead). Empty values is a real, tested state: AC-6 covers "no data
   * for this dimension" with an all-grey overlay + legend notice, so this
   * ships correctly pending real entries -- and non-empty top-level keys
   * mean the overlay panel still renders all four toggles (Law 17). */
  heatmapMappings: Record<string, HeatmapMapping>;
}

export const DEFAULT_EXPLORER_CONFIG: ExplorerConfig = Object.freeze({
  ceTimeoutMs: 10_000,
  nodeLabelThreshold: 0.3,
  edgeLabelThreshold: 0.55,
  spotlightDimOpacity: 0.18,
  centreAnimationMs: 300,
  layoutSaveRetryDelaysMs: [2000, 4000, 8000],
  layoutGraphId: "whole-company",
  domainMembershipPredicate: "https://weave.example/ontology/bpmo#memberOfDomain",
  expandConfirmThreshold: 500,
  domainKind: "Domain",
  fcoseParams: FCOSE_PARAMS,
  edgehandlesParams: EDGEHANDLES_PARAMS,
  glossaryLayerKind: "Concept",
  governanceLayerKind: "Policy",
  governanceLayerPredicate: "https://weave.example/ontology/bpmo#governedBy",
  brandLayerKind: "",
  heatNoneColour: "var(--color-heat-none)",
  domainNoneColour: "var(--color-kind-fallback)",
  domainPalette: [
    "var(--color-series-1)",
    "var(--color-series-2)",
    "var(--color-series-3)",
    "var(--color-series-4)",
    "var(--color-series-5)",
    "var(--color-series-6)",
  ],
  heatmapMappings: {
    maturity: { path: "maturity", values: {} },
    investment: { path: "investment", values: {} },
    strategy: { path: "strategy", values: {} },
    lifecycle: { path: "lifecycle", values: {} },
  },
});
