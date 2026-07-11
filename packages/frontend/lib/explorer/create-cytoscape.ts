import cytoscape from "cytoscape";
import edgehandles from "cytoscape-edgehandles";
import fcose from "cytoscape-fcose";

import { resolveStylesheetTokens } from "./build-stylesheet";
import { EDGEHANDLES_PARAMS } from "./edgehandles-params";

// Registering the fcose layout extension is a module-level, one-time side
// effect -- cytoscape.use() throws if called twice with the same extension.
let fcoseRegistered = false;
function ensureFcoseRegistered(): void {
  if (fcoseRegistered) return;
  cytoscape.use(fcose);
  fcoseRegistered = true;
}

// TASK-023 AC-6: same one-time-registration guard as fcose, for the
// draw-edge gesture extension.
let edgehandlesRegistered = false;
function ensureEdgehandlesRegistered(): void {
  if (edgehandlesRegistered) return;
  cytoscape.use(edgehandles);
  edgehandlesRegistered = true;
}

/** Cytoscape draws to <canvas> and never resolves CSS custom properties --
 * reads a `var(--token)` design-token value straight from the DOM cascade,
 * the browser-only counterpart of resolveStylesheetTokens's injected
 * resolver. */
function readCssToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || token;
}

/** The only file that imports the real `cytoscape` / `cytoscape-fcose`
 * packages -- keeps the render-adapter's consumers (the canvas hook)
 * testable without a real DOM/WebGL renderer (ADR-001 seam). Elements load
 * separately via the renderer-adapter's `load()` (ADR-001), not here. */
export function createCytoscapeInstance(
  container: HTMLElement | null,
  stylesheet: cytoscape.StylesheetStyle[],
): cytoscape.Core {
  ensureFcoseRegistered();
  ensureEdgehandlesRegistered();
  const cy = cytoscape({
    container,
    elements: [],
    style: resolveStylesheetTokens(stylesheet, readCssToken),
    userPanningEnabled: true,
    userZoomingEnabled: true,
  });
  // TASK-023 AC-6: draw mode makes the whole node body the drag handle --
  // always wired at the library level, same as onBackgroundDoubleClick's
  // quick-add trigger; canEdit gates the *consequence* inside useDrawEdge,
  // not whether the gesture is wired (mirrors useQuickAdd's own pattern).
  cy.edgehandles(EDGEHANDLES_PARAMS).enableDrawMode();
  return cy;
}
