import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createFilterState } from "@/lib/explorer/filter-state";
import type { FilterState } from "@/lib/explorer/filter-state";
import type { LayerStatus } from "../use-filter-panel";

import { FilterPanel } from "../filter-panel";

const OFF_LAYERS: Record<string, LayerStatus> = { glossary: "off", brand: "off", governance: "off" };

function renderPanel(overrides: Partial<React.ComponentProps<typeof FilterPanel>> = {}) {
  const props = {
    entityTypes: ["Process", "Policy"],
    relTypes: ["https://weave.example/ontology/bpmo#relatesTo"],
    filterState: createFilterState(),
    layerStatus: OFF_LAYERS as React.ComponentProps<typeof FilterPanel>["layerStatus"],
    onToggleEntityType: vi.fn(),
    onToggleRelType: vi.fn(),
    onSetPropertyFilters: vi.fn(),
    onToggleLayer: vi.fn(),
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

  it("toggles a governed layer on click (AC-6)", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("switch", { name: "Toggle Glossary layer" }));

    expect(props.onToggleLayer).toHaveBeenCalledWith("glossary");
  });

  it("disables an empty layer's toggle with an explanatory tooltip, and never calls onToggleLayer (AC-6)", () => {
    const props = renderPanel({ layerStatus: { glossary: "off", brand: "empty", governance: "off" } });

    const brandToggle = screen.getByRole("switch", { name: "Toggle Brand layer" });
    expect(brandToggle).toBeDisabled();
    expect(brandToggle).toHaveAttribute("title", "No Brand content");

    fireEvent.click(brandToggle);
    expect(props.onToggleLayer).not.toHaveBeenCalled();
  });
});
