import type { Overlay } from "../overlay-engine";

export interface HeatmapMapping {
  /** key_properties path this dimension reads (e.g. "maturity"). */
  path: string;
  /** normalised free-text value -> colour token. */
  values: Record<string, string>;
}

export interface HeatmapConfig {
  /** --color-heat-none family token -- grey fallback for unmatched/absent values. */
  noneColour: string;
  heatmapMappings: Record<string, HeatmapMapping>;
}

// ponytail: RED-step stub -- real body in the next commit.
export function createHeatmapOverlay(_dimension: string, _config: HeatmapConfig): Overlay {
  throw new Error("not implemented");
}
