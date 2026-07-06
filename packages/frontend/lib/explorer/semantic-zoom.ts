/** AC-6: hide/show node and edge labels as the viewer zooms, so a
 * whole-company canvas stays legible instead of a wall of overlapping text. */
export interface SemanticZoomThresholds {
  nodeLabelThreshold: number;
  edgeLabelThreshold: number;
}

export interface ZoomStylable {
  zoom(): number;
  nodes(): { style(props: Record<string, number>): void };
  edges(): { style(props: Record<string, number>): void };
}

export function applySemanticZoom(cy: ZoomStylable, thresholds: SemanticZoomThresholds): void {
  const zoom = cy.zoom();
  cy.nodes().style({ "text-opacity": zoom < thresholds.nodeLabelThreshold ? 0 : 1 });
  cy.edges().style({ "text-opacity": zoom < thresholds.edgeLabelThreshold ? 0 : 1 });
}
