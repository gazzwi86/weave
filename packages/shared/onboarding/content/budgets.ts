/** Copy budgets (defaults, tunable -- PRD SS2.4). Word counts resolve against the `en` catalogue. */
export const TOUR_TOOLTIP_MAX_WORDS = 40;
export const BEACON_TOOLTIP_MAX_WORDS = 60;

/** Authoring guideline, not a hard budget -- CI warns, never fails (data-model.md). */
export const TOUR_STEP_COUNT_GUIDELINE = { min: 5, max: 12 };

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
