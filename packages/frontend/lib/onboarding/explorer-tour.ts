// ONB-V1-TASK-002: pure gating helper for the `?tour=completeness-map`
// deep-link (the help-launcher entry point into `tour.ge.completeness-map`,
// AC-002-01). Kept separate from the ExplorerTour component so the
// start/no-start decision is unit-testable without mounting React/Driver.js.
import type { Tour } from "../../../shared/onboarding/content/schema";
import type { RolePath } from "../../../shared/onboarding/types";
import { isTourShipped } from "./tour-content";

export const COMPLETENESS_TOUR_QUERY_VALUE = "completeness-map";

/** AC-002-01/04: only auto-start once the role path has resolved, the path
 * opts into this tour, and every step anchor is shipped -- never offer a
 * half-shipped tour off a bare query param. */
export function shouldAutoStartCompletenessTour(
  tourParam: string | null | undefined,
  resolvedPath: RolePath | null,
  tour: Tour,
): boolean {
  if (tourParam !== COMPLETENESS_TOUR_QUERY_VALUE) return false;
  if (!resolvedPath) return false;
  if (!tour.paths.includes(resolvedPath)) return false;
  return isTourShipped(tour);
}
