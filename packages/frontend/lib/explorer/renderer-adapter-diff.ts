import type { AdaptableCy } from "./renderer-adapter";

export type DiffClassName = "explorer-diff-added" | "explorer-diff-removed" | "explorer-diff-modified";

export const DIFF_CLASSES: DiffClassName[] = ["explorer-diff-added", "explorer-diff-removed", "explorer-diff-modified"];

export interface DiffOverlayAssignment {
  id: string;
  className: DiffClassName;
  /** data-viz.md "Diff overlay": border colour alone fails WCAG 1.4.1 --
   * every assignment carries a glyph (+/-/~) prefixed onto a dedicated
   * `diffLabel` data field, read by the diff-classed stylesheet selector. */
  glyph: string;
}

/** TASK-022 AC-3: one batched pass -- border class + glyph-prefixed label
 * per assigned node/edge id. Missing ids (e.g. a stale ghost) are a no-op,
 * not an error. */
export function setDiffOverlayOn(cy: AdaptableCy, assignments: DiffOverlayAssignment[]): void {
  cy.batch(() => {
    for (const { id, className, glyph } of assignments) {
      const element = cy.getElementById(id);
      if (element.length === 0) continue;
      element.addClass(className);
      element.data("diffLabel", `${glyph} ${String(element.data("label") ?? "")}`);
    }
  });
}

/** TASK-022 AC-8: restores the pre-diff canvas -- clears every diff class
 * and the glyph label in one batched pass across nodes and edges. */
export function clearDiffOverlayOn(cy: AdaptableCy): void {
  cy.batch(() => {
    const all = cy.elements();
    DIFF_CLASSES.forEach((className) => all.removeClass(className));
    all.data("diffLabel", undefined);
  });
}
