/** GE-CANVAS-1 (contracts.md §GE-CANVAS-1; ge-canvas-1.md "Packaging"): the
 * Explorer module's package public API -- Build imports GraphCanvas ONLY
 * through this module. Nothing else Explorer-internal (CanvasCore,
 * ExplorerInteractions, hooks, etc.) is re-exported here; AC-1's
 * import-surface test asserts this file's export set stays exactly
 * `{ GraphCanvas }` (types are erased at runtime, so only the value export
 * is checkable at import time). */
export { GraphCanvas } from "@/components/explorer/graph-canvas";
export type { GraphCanvasProps } from "@/components/explorer/graph-canvas";
