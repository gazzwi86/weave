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

  it("defaults to variant='error' with role=alert (back-compat, TASK-023's existing callers)", () => {
    render(<Toast message="Couldn't save" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it.each([
    ["success", "status"],
    ["info", "status"],
    ["error", "alert"],
  ] as const)("variant=%s renders role=%s", (variant, role) => {
    render(<Toast message="Saved" onDismiss={vi.fn()} variant={variant} />);
    expect(screen.getByRole(role)).toBeInTheDocument();
  });

  it("clicking Dismiss calls onDismiss synchronously (no animation delay for direct callers)", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
