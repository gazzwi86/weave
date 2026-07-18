/** AC-6: hide/show node and edge labels as the viewer zooms, so a
 * whole-company canvas stays legible instead of a wall of overlapping text.
 * V3b-2 item 1: alwaysLabelledKinds are orienting landmarks (e.g. domains)
 * that stay labelled below nodeLabelThreshold so a zoomed-out, hundreds-of-
 * node canvas still has legible anchors. */
export interface SemanticZoomThresholds {
  nodeLabelThreshold: number;
  edgeLabelThreshold: number;
  alwaysLabelledKinds: string[];
}

export interface ZoomStylable {
  zoom(): number;
  nodes(selector?: string): { style(props: Record<string, number>): void };
  edges(): { style(props: Record<string, number>): void };
}

function alwaysLabelledSelector(kinds: string[]): string {
  return kinds.map((kind) => `[bpmo_kind = "${kind}"]`).join(", ");
}

export function applySemanticZoom(cy: ZoomStylable, thresholds: SemanticZoomThresholds): void {
  const zoom = cy.zoom();
  cy.nodes().style({ "text-opacity": zoom < thresholds.nodeLabelThreshold ? 0 : 1 });
  cy.edges().style({ "text-opacity": zoom < thresholds.edgeLabelThreshold ? 0 : 1 });
  if (thresholds.alwaysLabelledKinds.length > 0) {
    cy.nodes(alwaysLabelledSelector(thresholds.alwaysLabelledKinds)).style({ "text-opacity": 1 });
  }
}
