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
  fcoseParams: typeof FCOSE_PARAMS;
}

export const DEFAULT_EXPLORER_CONFIG: ExplorerConfig = Object.freeze({
  ceTimeoutMs: 10_000,
  nodeLabelThreshold: 0.3,
  edgeLabelThreshold: 0.55,
  spotlightDimOpacity: 0.18,
  centreAnimationMs: 300,
  fcoseParams: FCOSE_PARAMS,
});
