import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";

import type { CytoscapeElement } from "./types";

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
 * testable without a real DOM/WebGL renderer (ADR-001 seam). */
export function createCytoscapeInstance(
  container: HTMLElement | null,
  elements: CytoscapeElement[],
  stylesheet: cytoscape.StylesheetStyle[],
): cytoscape.Core {
  ensureFcoseRegistered();
  return cytoscape({
    container,
    elements,
    style: stylesheet,
    userPanningEnabled: true,
    userZoomingEnabled: true,
  });
}
