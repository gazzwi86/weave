import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntityPicker } from "../EntityPicker";

const RESULT = { iri: "urn:weave:instances:e1", label: "Expense policy", kind: "policy" };

describe("EntityPicker", () => {
  it("renders a labelled combobox and calls onSelect for a suggestion", () => {
    const onSelect = vi.fn();
    render(
      <EntityPicker
        id="grounding-entities"
        label="Grounding entities"
        query="exp"
        onQueryChange={vi.fn()}
        results={[RESULT]}
        selected={[]}
        onSelect={onSelect}
        onRemove={vi.fn()}
      />
    );

    const combobox = screen.getByLabelText("Grounding entities");
    expect(combobox).toBeInTheDocument();
    fireEvent.focus(combobox);
    fireEvent.mouseDown(screen.getByText("Expense policy"));
    expect(onSelect).toHaveBeenCalledWith(RESULT);
  });

  it("renders a removable chip for each selected entity and calls onRemove", () => {
    const onRemove = vi.fn();
    render(
      <EntityPicker
        id="grounding-entities"
        label="Grounding entities"
        query=""
        onQueryChange={vi.fn()}
        results={[]}
        selected={[RESULT]}
        onSelect={vi.fn()}
        onRemove={onRemove}
      />
    );

    expect(screen.getByText("Expense policy")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Remove Expense policy"));
    expect(onRemove).toHaveBeenCalledWith("urn:weave:instances:e1");
  });
});
