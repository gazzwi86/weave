import type { AdaptableCy } from "./renderer-adapter";

export const EXPLORER_GAP_BADGE_CLASS = "explorer-gap-badge";

/** TASK-027 AC-1/AC-7: badge channel, separate from the "colour"
 * background-colour seam (renderer-adapter-colour.ts) -- coexists with an
 * active colour overlay. One batched pass; `gapBadgeLabel` is a
 * WCAG-1.4.1 text equivalent (glyph + count), never colour alone --
 * appended to the node's own label rather than replacing it (unlike the
 * diff overlay's diffLabel, since a gap badge stacks with the base view
 * instead of taking it over). Missing ids (off-canvas rows, AC-6) are a
 * no-op, not an error. */
export function setBadgesOn(cy: AdaptableCy, countByNodeId: Record<string, number>): void {
  cy.batch(() => {
    for (const [id, count] of Object.entries(countByNodeId)) {
      const element = cy.getElementById(id);
      if (element.length === 0) continue;
      element.addClass(EXPLORER_GAP_BADGE_CLASS);
      element.data("gapBadgeLabel", `${String(element.data("label") ?? "")} ⚠ ${count}`);
    }
  });
}

/** TASK-027: clears the gap-badge class + label in one batched pass. */
export function clearBadgesOn(cy: AdaptableCy): void {
  cy.batch(() => {
    const all = cy.elements();
    all.removeClass(EXPLORER_GAP_BADGE_CLASS);
    all.data("gapBadgeLabel", undefined);
  });
}
