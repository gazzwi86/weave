import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";

import { readCssToken, resolveStylesheetTokens } from "./build-stylesheet";

// Registering the fcose layout extension is a module-level, one-time side
// effect -- cytoscape.use() throws if called twice with the same extension.
let fcoseRegistered = false;
function ensureFcoseRegistered(): void {
  if (fcoseRegistered) return;
  cytoscape.use(fcose);
  fcoseRegistered = true;
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
  return cytoscape({
    container,
    elements: [],
    style: resolveStylesheetTokens(stylesheet, readCssToken),
    userPanningEnabled: true,
    userZoomingEnabled: true,
  });
}
