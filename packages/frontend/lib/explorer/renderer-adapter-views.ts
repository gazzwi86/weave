import type { AdaptableCy, Viewport } from "./renderer-adapter";
import type { CytoscapeElement } from "./types";

/** TASK-026 AC-1/AC-2: saved-view viewport capture/restore -- a sibling
 * module to renderer-adapter.ts (already over Law E's file-cap, waived
 * for TASK-020) rather than growing that file further. */
export function setViewportOn(cy: AdaptableCy, viewport: Viewport): void {
  cy.zoom(viewport.zoom);
  cy.pan(viewport.pan);
}

export function allNodePositionsOn(cy: AdaptableCy): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  cy.nodes().map((node) => {
    positions[node.id()] = node.position();
    return null;
  });
  return positions;
}

/** TASK-026 AC-2: "positions before fcose" -- only ever moves a node
 * already on the canvas; a position for an entity the view referenced but
 * that no longer exists is silently skipped (AC-3 flags that separately). */
export function applyPositionsOn(cy: AdaptableCy, positions: Record<string, { x: number; y: number }>): void {
  cy.batch(() => {
    Object.entries(positions).forEach(([id, position]) => {
      const node = cy.getElementById(id);
      if (node.length > 0) node.position(position);
    });
  });
}

/** TASK-026 AC-7: merges a poll delta into the live canvas -- new elements
 * are added, existing ones get their data refreshed in place, and any id in
 * `preserveIds` (unsaved drag positions) is skipped entirely so a poll tick
 * never clobbers a gesture in progress. Never a full reload/re-layout. */
export function mergeInPlaceOn(cy: AdaptableCy, delta: CytoscapeElement[], preserveIds: string[]): void {
  const preserve = new Set(preserveIds);
  const toAdd: CytoscapeElement[] = [];

  cy.batch(() => {
    delta.forEach((element) => {
      if (preserve.has(element.data.id)) return;
      const existing = cy.getElementById(element.data.id);
      if (existing.length > 0) {
        Object.entries(element.data).forEach(([key, value]) => existing.data(key, value));
      } else {
        toAdd.push(element);
      }
    });
    if (toAdd.length > 0) cy.add(toAdd);
  });
}
