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
  fcoseParams: typeof FCOSE_PARAMS;
}

export const DEFAULT_EXPLORER_CONFIG: ExplorerConfig = Object.freeze({
  ceTimeoutMs: 10_000,
  nodeLabelThreshold: 0.3,
  edgeLabelThreshold: 0.55,
  fcoseParams: FCOSE_PARAMS,
});
