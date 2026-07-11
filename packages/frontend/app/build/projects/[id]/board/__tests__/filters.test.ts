import { describe, expect, it } from "vitest";

import { filterCards, isValidFilter } from "../filters";
import type { BoardCard } from "../types";

function card(overrides: Partial<BoardCard>): BoardCard {
  return {
    id: "task-1",
    status: "Ready",
    lane: "Ready",
    failure_class: null,
    retry_attempt: null,
    retry_ceiling: null,
    hitl_escalated: false,
    ...overrides,
  };
}

describe("board filters", () => {
  it("should treat invalid filter as empty state", () => {
    expect(isValidFilter("not-a-real-filter")).toBe(false);
    expect(isValidFilter(null)).toBe(false);
    expect(isValidFilter("All")).toBe(true);
  });

  it("should show empty state and reset to All when filter matches zero tasks", () => {
    const cards = [card({ id: "t-1", status: "Ready", lane: "Ready" })];
    expect(filterCards(cards, "Blocked")).toEqual([]);
    expect(filterCards(cards, "All")).toEqual(cards);
  });

  it("'In flight' excludes Backlog and Done lanes", () => {
    const cards = [
      card({ id: "t-1", lane: "Backlog" }),
      card({ id: "t-2", lane: "Ready" }),
      card({ id: "t-3", lane: "Done" }),
    ];
    expect(filterCards(cards, "In flight").map((c) => c.id)).toEqual(["t-2"]);
  });
});
