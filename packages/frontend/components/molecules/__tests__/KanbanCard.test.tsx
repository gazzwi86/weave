import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

import { KanbanCard } from "../KanbanCard";

describe("KanbanCard", () => {
  it("renders the title and a mono task id", () => {
    render(<KanbanCard taskId="TASK-014" title="Email notifications on RMA" />);
    expect(screen.getByText("Email notifications on RMA")).toBeInTheDocument();
    expect(screen.getByText("TASK-014")).toBeInTheDocument();
  });

  it("renders chips passed into the chips slot", () => {
    render(
      <KanbanCard taskId="TASK-009" title="Refund calculation" chips={<Badge variant="danger">blocked</Badge>} />
    );
    expect(screen.getByText("blocked")).toBeInTheDocument();
  });

  it("dims the card when marked done", () => {
    render(<KanbanCard taskId="TASK-001" title="Intake form" dimmed />);
    expect(screen.getByTestId("kanban-card-TASK-001")).toHaveClass("opacity-70");
  });
});
