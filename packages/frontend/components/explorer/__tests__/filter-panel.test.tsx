import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createFilterState } from "@/lib/explorer/filter-state";
import type { FilterState } from "@/lib/explorer/filter-state";

import { FilterPanel } from "../filter-panel";

function renderPanel(overrides: Partial<React.ComponentProps<typeof FilterPanel>> = {}) {
  const props = {
    entityTypes: ["Process", "Policy"],
    relTypes: ["https://weave.example/ontology/bpmo#relatesTo"],
    filterState: createFilterState(),
    onToggleEntityType: vi.fn(),
    onToggleRelType: vi.fn(),
    onSetPropertyFilters: vi.fn(),
    ...overrides,
  };
  render(<FilterPanel {...props} />);
  return props;
}

describe("FilterPanel", () => {
  it("renders a checked checkbox per entity type present, unchecked when toggled off (AC-1)", () => {
    const filterState: FilterState = { ...createFilterState(), entityTypesOff: ["Policy"] };
    renderPanel({ filterState });

    expect(screen.getByRole("checkbox", { name: "Process" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Policy" })).not.toBeChecked();
  });

  it("calls onToggleEntityType with the kind token when its checkbox is clicked", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("checkbox", { name: "Process" }));

    expect(props.onToggleEntityType).toHaveBeenCalledWith("Process");
  });

  it("renders a human-readable label for a relationship type's predicate IRI and toggles it (AC-3)", () => {
    const props = renderPanel();

    const relCheckbox = screen.getByRole("checkbox", { name: "relatesTo" });
    fireEvent.click(relCheckbox);

    expect(props.onToggleRelType).toHaveBeenCalledWith("https://weave.example/ontology/bpmo#relatesTo");
  });

  it("adds a property filter via keyboard-operable form fields (AC-4)", () => {
    const props = renderPanel();

    fireEvent.change(screen.getByLabelText("Property path"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("Comparison"), { target: { value: "eq" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "active" } });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));

    expect(props.onSetPropertyFilters).toHaveBeenCalledWith([{ path: "status", op: "eq", value: "active" }]);
  });

  it("removes an existing property filter chip", () => {
    const filterState: FilterState = {
      ...createFilterState(),
      propertyFilters: [{ path: "status", op: "eq", value: "active" }],
    };
    const props = renderPanel({ filterState });

    fireEvent.click(screen.getByRole("button", { name: "Remove filter: status eq active" }));

    expect(props.onSetPropertyFilters).toHaveBeenCalledWith([]);
  });

});
