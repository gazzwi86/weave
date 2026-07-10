import type { Overlay } from "../overlay-engine";
import type { OverlayEngine } from "../overlay-engine";

/** ADR-018 traversal result -- the pin's input, produced by the impact/
 * dependency walk (whichever direction was run to get here). */
export interface PinnedTraceResult {
  sourceIri: string;
  memberIris: string[];
}

export function createPinnedImpactOverlay(
  traceResult: PinnedTraceResult,
  engine: OverlayEngine,
  notify: (message: string) => void,
): Overlay {
  throw new Error("not implemented");
}
