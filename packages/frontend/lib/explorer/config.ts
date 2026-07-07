import { FCOSE_PARAMS } from "./fcose-params";

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
});
