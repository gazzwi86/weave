import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toast } from "../toast";

describe("Toast", () => {
  it("renders only Dismiss when no action is given", () => {
    render(<Toast message="Saved" onDismiss={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  // TASK-023 AC-5: the write-proxy failure toast offers a retry that
  // re-runs the exact same commit, distinct from dismissing the toast.
  it("calls the action's onClick, not onDismiss, when its button is clicked", () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    render(<Toast message="Edit failed" onDismiss={onDismiss} action={{ label: "Retry", onClick: onAction }} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onAction).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
