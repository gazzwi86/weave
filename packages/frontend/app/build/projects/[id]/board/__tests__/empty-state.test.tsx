import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("B3: shows the designed no-tasks-yet copy with no reset button when the board has no tasks at all", () => {
    render(<EmptyState hasAnyTasks={false} onReset={vi.fn()} />);

    expect(screen.getByText("No tasks yet — they appear when a build run starts.")).toBeInTheDocument();
    expect(screen.queryByText("No tasks match this filter.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to All" })).not.toBeInTheDocument();
  });

  it("B3: keeps the filtered-out copy + reset button when tasks exist but the filter matched none", () => {
    render(<EmptyState hasAnyTasks={true} onReset={vi.fn()} />);

    expect(screen.getByText("No tasks match this filter.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to All" })).toBeInTheDocument();
  });
});
