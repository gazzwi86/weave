import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { NodeKind } from "@/lib/explorer/types";

import { QuickAddPopover } from "../quick-add-popover";

const KINDS: NodeKind[] = [
  { id: "Process", label: "Process", colour: "var(--color-kind-process)" },
  { id: "Actor", label: "Actor", colour: "var(--color-kind-actor)" },
];

describe("QuickAddPopover", () => {
  // AC-3: stays closed until a double-click opens it.
  it("renders nothing when not open", () => {
    render(<QuickAddPopover open={false} kinds={KINDS} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits the entered name and selected kind", () => {
    const onSubmit = vi.fn();
    render(<QuickAddPopover open={true} kinds={KINDS} onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Invoicing" } });
    fireEvent.change(screen.getByLabelText(/kind/i), { target: { value: "Actor" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Invoicing", "Actor");
  });

  // AC-3: an empty name is not a valid node -- no network call for it.
  it("does not submit with a blank name", () => {
    const onSubmit = vi.fn();
    render(<QuickAddPopover open={true} kinds={KINDS} onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onCancel when the viewer cancels", () => {
    const onCancel = vi.fn();
    render(<QuickAddPopover open={true} kinds={KINDS} onSubmit={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});
