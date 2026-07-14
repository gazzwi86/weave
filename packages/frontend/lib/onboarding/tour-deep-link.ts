// ONB-V1-TASK-004: generic `?tour=<value>` deep-link gate shared by both
// new tour hosts. Sibling of explorer-tour.ts's shouldAutoStartCompletenessTour
// but deliberately does NOT check `tour.paths` -- see the test file's header
// comment for why (AC-004-05 dead-CTA avoidance).
import type { Tour } from "../../../shared/onboarding/content/schema";
import { isTourShipped } from "./tour-content";

export function shouldAutoStartQueryTour(
  tourParam: string | null | undefined,
  queryValue: string,
  tour: Tour,
): boolean {
  if (tourParam !== queryValue) return false;
  return isTourShipped(tour);
}
