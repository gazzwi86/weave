import { resolveValue } from "./build-stylesheet";
import type { AdaptableCy } from "./renderer-adapter";

/** TASK-021 AC-4/AC-7: colour overlay seam -- one batched pass, nodes
 * grouped by target colour (bounded by distinct colours, e.g. the 5-step
 * heat ramp or a 6-slot series palette, never by node count) so the
 * 300ms budget holds regardless of how many nodes share a colour.
 *
 * Overlays hand in `var(--token)` colours (heatmap-overlay.ts,
 * domain-colouring-overlay.ts) -- Cytoscape draws to <canvas> and never
 * resolves those itself, so `resolve` (the same injected DOM reader
 * resolveStylesheetTokens uses for the base stylesheet) resolves each one
 * to a concrete value before it reaches `.style()`. */
export function applyNodeColoursOn(
  cy: AdaptableCy,
  colourByNodeId: Record<string, string>,
  fallbackColour: string,
  resolve: (token: string) => string,
): void {
  const idsByColour = new Map<string, Set<string>>();
  for (const [id, colour] of Object.entries(colourByNodeId)) {
    const resolved = resolveValue(colour, resolve) as string;
    if (!idsByColour.has(resolved)) idsByColour.set(resolved, new Set());
    idsByColour.get(resolved)!.add(id);
  }
  const assignedIds = new Set(Object.keys(colourByNodeId));

  cy.batch(() => {
    for (const [colour, ids] of idsByColour) {
      cy.nodes()
        .filter((node) => ids.has(node.id()))
        .style({ "background-color": colour });
    }
    cy.nodes()
      .filter((node) => !assignedIds.has(node.id()))
      .style({ "background-color": resolveValue(fallbackColour, resolve) as string });
  });
}

/** TASK-021 AC-4: clears the inline colour override in one batched pass,
 * letting the base stylesheet's bpmo_kind selector colouring reassert --
 * this is "restore prior colouring" since colour overlays never touch the
 * stylesheet itself, only an inline style on top of it. */
export function clearNodeColoursOn(cy: AdaptableCy): void {
  cy.batch(() => {
    cy.nodes().style({ "background-color": "" });
  });
}
