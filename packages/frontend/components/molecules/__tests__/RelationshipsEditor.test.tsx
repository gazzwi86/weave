import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RelationshipsEditor, type Relationship } from "../RelationshipsEditor";

const rels: Relationship[] = [
  { predicate: "related to", target: "Vendor risk policy" },
  { predicate: "governs", target: "Onboard vendor" },
];

function renderEditor(overrides: Partial<React.ComponentProps<typeof RelationshipsEditor>> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  render(<RelationshipsEditor rels={rels} onAdd={onAdd} onRemove={onRemove} {...overrides} />);
  return { onAdd, onRemove };
}

describe("RelationshipsEditor", () => {
  it("renders one chip per relationship, labelled predicate + target", () => {
    renderEditor();
    expect(screen.getByText("related to · Vendor risk policy")).toBeInTheDocument();
    expect(screen.getByText("governs · Onboard vendor")).toBeInTheDocument();
  });

  it("renders no chips when rels is empty", () => {
    renderEditor({ rels: [] });
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });

  it("calls onRemove with the chip's index when its remove button is clicked", () => {
    const { onRemove } = renderEditor();
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons.at(1)!);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("calls onAdd with the selected predicate and typed target, then clears the input", () => {
    const { onAdd } = renderEditor();
    fireEvent.change(screen.getByLabelText("Relationship predicate"), { target: { value: "narrower" } });
    const targetInput = screen.getByPlaceholderText("Type to find an entity or term…");
    fireEvent.change(targetInput, { target: { value: "Compliance officer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("narrower", "Compliance officer");
    expect(targetInput).toHaveValue("");
  });

  it("does not call onAdd when the target input is empty", () => {
    const { onAdd } = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("renders the hint line", () => {
    renderEditor();
    expect(
      screen.getByText("Links live in the graph — they appear on the canvas and in queries immediately.")
    ).toBeInTheDocument();
  });

  it("renders its own 'Relationships' label by default", () => {
    renderEditor();
    expect(screen.getByText("Relationships")).toBeInTheDocument();
  });

  it("omits its own label when hideLabel is set (caller renders the section label instead)", () => {
    renderEditor({ hideLabel: true });
    expect(screen.queryByText("Relationships")).not.toBeInTheDocument();
  });
});
