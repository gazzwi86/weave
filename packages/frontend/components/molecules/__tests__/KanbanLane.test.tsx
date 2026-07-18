import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KanbanCard } from "../KanbanCard";
import { KanbanLane } from "../KanbanLane";

describe("KanbanLane", () => {
  it("renders the lane title and card count", () => {
    render(
      <KanbanLane title="Backlog" count={2}>
        <KanbanCard taskId="TASK-014" title="Email notifications on RMA" />
        <KanbanCard taskId="TASK-015" title="Restock exception report" />
      </KanbanLane>
    );
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders its card children in a scrollable list", () => {
    render(
      <KanbanLane title="Ready" count={1}>
        <KanbanCard taskId="TASK-011" title="Restock pipeline — data model" />
      </KanbanLane>
    );
    expect(screen.getByText("Restock pipeline — data model")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-lane-cards")).toHaveClass("overflow-y-auto");
  });
});
