/** FR-017 (BE-V1-TASK-017): the five fixed board filters, URL-state driven
 * (`?filter=`). AC-4/AC-5: an unrecognised value resolves the same way a
 * zero-match filter does -- the empty-state case, never a broken board.
 */

import type { BoardCard } from "./types";

export const BOARD_FILTERS = [
  "All",
  "In flight",
  "Blocked",
  "Self-improvement-flagged",
  "This phase",
] as const;

export type BoardFilter = (typeof BOARD_FILTERS)[number];

export function isValidFilter(value: string | null): value is BoardFilter {
  return value !== null && (BOARD_FILTERS as readonly string[]).includes(value);
}

/** ADR-023 #5/#6: "Self-improvement-flagged" has no backing field in M1
 * (always empty -- honestly exercises AC-4). "This phase" approximates to
 * the one per-task phase-relevant signal the board card actually carries:
 * `hitl_escalated` (the task currently holding up the run's active phase).
 */
export function filterCards(cards: BoardCard[], filter: BoardFilter): BoardCard[] {
  switch (filter) {
    case "All":
      return cards;
    case "In flight":
      return cards.filter((card) => card.lane !== "Backlog" && card.lane !== "Done");
    case "Blocked":
      return cards.filter((card) => card.status === "Blocked");
    case "Self-improvement-flagged":
      return [];
    case "This phase":
      return cards.filter((card) => card.hitl_escalated);
    default:
      return [];
  }
}
