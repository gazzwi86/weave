// ONB-TASK-007: pure helpers over the shared onboarding tour config.
// Relative-imports packages/shared (precedent: change-viz.tsx's
// widget-compat.json import + turbopack.root in next.config.ts) -- no
// @weave/shared workspace wiring exists in this repo yet (see TASK-006
// summary); adding a full package alias for two small config modules is
// out of scope here, mirrors the existing pattern instead.
import { ANCHORS, type AnchorId } from "../../../shared/onboarding/anchors";
import type { RolePath } from "../../../shared/onboarding/types";
import type { Tour, TourStep } from "../../../shared/onboarding/content/schema";

/** AC-007-04 (2nd half): a tour is flagged off entirely if any step's anchor
 * is not yet shipped (planted in the DOM) -- ADR-008's `shipped` flag. */
export function isTourShipped(tour: Tour): boolean {
  return tour.steps.every((step) => ANCHORS[step.anchorId].shipped);
}

/** AC-007-05: only tours whose `paths` include the resolved role path, and
 * only tours whose anchors are all shipped (AC-007-04). Completed tours are
 * never excluded -- re-takeable any time. */
export function availableTours(tours: Tour[], resolvedPath: RolePath): Tour[] {
  return tours.filter((tour) => tour.paths.includes(resolvedPath) && isTourShipped(tour));
}

/** AC-007-04 (1st half): steps whose anchor element isn't present in the DOM
 * are skipped with a logged warning -- kept out of the renderable sequence
 * so the step indicator never shows a ghost count. */
export function renderableSteps(
  tour: Tour,
  hasAnchor: (anchorId: AnchorId) => boolean,
): TourStep[] {
  const result: TourStep[] = [];
  for (const step of tour.steps) {
    if (hasAnchor(step.anchorId)) {
      result.push(step);
    } else {
      // eslint-disable-next-line no-console -- AC-007-04: logged warning, anchor id included.
      console.warn(`[onboarding] tour "${tour.tourId}" step anchor absent, skipping: ${step.anchorId}`);
    }
  }
  return result;
}

/** Default DOM presence check: `[data-tour-id="<anchorId>"]` in the document. */
export function domHasAnchor(anchorId: AnchorId): boolean {
  return document.querySelector(`[data-tour-id="${anchorId}"]`) !== null;
}
