import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LaneGrid } from "../lane-grid";
import type { BoardCard } from "../types";

function card(overrides: Partial<BoardCard>): BoardCard {
  return {
    id: "TASK-001",
    status: "In Progress",
    lane: "In Progress",
    failure_class: null,
    retry_attempt: null,
    retry_ceiling: null,
    hitl_escalated: false,
    ...overrides,
  };
}

describe("LaneGrid", () => {
  it("refit-mock #sub-bld-kanban: renders one KanbanLane per lane, cards grouped by lane", () => {
    const cards = [card({ id: "TASK-001", lane: "Backlog" }), card({ id: "TASK-002", lane: "Done" })];
    render(<LaneGrid cards={cards} projectId="urn:weave:project:acme:hv" />);

    expect(screen.getByTestId("kanban-card-TASK-001")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-card-TASK-002")).toBeInTheDocument();
    // Six lanes, one per LANE_ORDER entry.
    expect(screen.getAllByText("Backlog").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
  });

  it("shows the retry/HITL chip on a failed card via the reused RetryChip", () => {
    const cards = [
      card({ id: "TASK-003", lane: "QA", failure_class: "syntax", retry_attempt: 2, retry_ceiling: 3, hitl_escalated: true }),
    ];
    render(<LaneGrid cards={cards} projectId="urn:weave:project:acme:hv" />);

    const kanbanCard = screen.getByTestId("kanban-card-TASK-003");
    expect(kanbanCard.querySelector('[data-testid="retry-chip"]')).toBeInTheDocument();
    expect(kanbanCard).toHaveTextContent("syntax 2/3");
    expect(kanbanCard).toHaveTextContent("HITL escalated");
  });

  it("dims Done-lane cards", () => {
    const cards = [card({ id: "TASK-004", lane: "Done" })];
    render(<LaneGrid cards={cards} projectId="urn:weave:project:acme:hv" />);

    expect(screen.getByTestId("kanban-card-TASK-004").className).toContain("opacity-90");
  });

  it("links each card to the task-detail page", () => {
    const cards = [card({ id: "TASK-005", lane: "Ready" })];
    render(<LaneGrid cards={cards} projectId="urn:weave:project:acme:hv" />);

    const link = screen.getByTestId("kanban-card-TASK-005").closest("a");
    expect(link).toHaveAttribute("href", "/build/projects/urn%3Aweave%3Aproject%3Aacme%3Ahv/tasks/TASK-005");
  });
});
