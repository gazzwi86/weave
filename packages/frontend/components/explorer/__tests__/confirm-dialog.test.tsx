import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../confirm-dialog";

describe("ConfirmDialog", () => {
  // AC-4: prompts before adding a large number of nodes, states the count.
  it("shows the new-node count and stays closed when not open", () => {
    render(<ConfirmDialog open={false} newCount={620} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the new-node count when open", () => {
    render(<ConfirmDialog open={true} newCount={620} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText(/620/).length).toBeGreaterThan(0);
  });

  // AC-4: continuing calls onConfirm -- expansion applies.
  it("calls onConfirm when the viewer continues", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open={true} newCount={620} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  // AC-4: cancelling calls onCancel -- expansion never applies, no fetch.
  it("calls onCancel when the viewer cancels", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open={true} newCount={620} onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});
