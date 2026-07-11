import type { Beacon, Tour } from "../content/schema";
import { BEACON_TOOLTIP_MAX_WORDS, TOUR_TOOLTIP_MAX_WORDS, wordCount } from "../content/budgets";
import { resolveKey } from "../content/i18n";

/** AC-003-03: tour tooltip ≤ 40 words, beacon tooltip ≤ 60 words -- resolved against `en`. */
export function checkCopyBudgets(tours: Tour[], beacons: Beacon[]): string[] {
  const errors: string[] = [];

  for (const tour of tours) {
    for (const step of tour.steps) {
      const words = wordCount(resolveKey(step.bodyKey));
      if (words > TOUR_TOOLTIP_MAX_WORDS) {
        errors.push(`tour "${tour.tourId}" step "${step.anchorId}" body is ${words} words (max ${TOUR_TOOLTIP_MAX_WORDS})`);
      }
    }
  }

  for (const beacon of beacons) {
    const words = wordCount(resolveKey(beacon.bodyKey));
    if (words > BEACON_TOOLTIP_MAX_WORDS) {
      errors.push(`beacon "${beacon.beaconId}" body is ${words} words (max ${BEACON_TOOLTIP_MAX_WORDS})`);
    }
  }
  return errors;
}
