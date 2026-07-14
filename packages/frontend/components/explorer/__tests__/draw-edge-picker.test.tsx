import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RelKind } from "@/lib/explorer/types";

import { DrawEdgePicker } from "../draw-edge-picker";

const REL_TYPES: RelKind[] = [
  { id: "performs", label: "Performs" },
  { id: "owns", label: "Owns" },
];

describe("DrawEdgePicker", () => {
  it("does not render when closed", () => {
    render(<DrawEdgePicker open={false} relTypes={REL_TYPES} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText("Choose relationship")).not.toBeInTheDocument();
  });

  it("submits the selected relationship type", () => {
    const onSubmit = vi.fn();
    render(<DrawEdgePicker open relTypes={REL_TYPES} onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Relationship"), { target: { value: "owns" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(onSubmit).toHaveBeenCalledWith("owns");
  });

  it("cancels via the Cancel button", () => {
    const onCancel = vi.fn();
    render(<DrawEdgePicker open relTypes={REL_TYPES} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
