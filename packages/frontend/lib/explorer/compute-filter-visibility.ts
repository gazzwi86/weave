import type { FilterState } from "./filter-state";
import type { CytoscapeElement } from "./types";

export interface FilterVisibilityResult {
  hiddenNodeIds: string[];
  dimmedNodeIds: string[];
  hiddenEdgeIds: string[];
  /** AC-2: every loaded node's kind is toggled off. */
  isEmpty: boolean;
  /** AC-5: property filters are active but no visible node matches. */
  filterMatchEmpty: boolean;
}

export function computeFilterVisibility(_elements: CytoscapeElement[], _state: FilterState): FilterVisibilityResult {
  throw new Error("not implemented");
}
