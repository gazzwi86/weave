import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskTree } from "../task-tree";
import type { TaskTreeNode } from "../types";

describe("TaskTree", () => {
  it("should flag missing blocked_by predecessor instead of dropping node", () => {
    const nodes: TaskTreeNode[] = [
      { id: "task-2", status: "Ready", blocked_by: ["task-1-missing"], missing: false },
      { id: "task-1-missing", status: "missing", blocked_by: [], missing: true },
    ];

    render(<TaskTree nodes={nodes} />);

    expect(screen.getAllByTestId("tree-node")).toHaveLength(2);
    expect(screen.getByText("task-1-missing")).toBeInTheDocument();
    expect(screen.getByText("missing dependency")).toBeInTheDocument();
  });
});
