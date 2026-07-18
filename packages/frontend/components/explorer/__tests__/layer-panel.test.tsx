import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LayerStatus } from "../use-filter-panel";
import { LayerPanel } from "../filter-panel";

const OFF_LAYERS: Record<string, LayerStatus> = { glossary: "off", brand: "off", governance: "off" };

// Split out of filter-panel.test.tsx when LayerPanel moved to its own
// ControlDock "Layers" tab (TASK-020's original bundle split apart).
describe("LayerPanel", () => {
  it("toggles a governed layer on click (AC-6)", () => {
    const onToggleLayer = vi.fn();
    render(<LayerPanel layerStatus={OFF_LAYERS as Record<string, LayerStatus>} onToggleLayer={onToggleLayer} />);

    fireEvent.click(screen.getByRole("switch", { name: "Toggle Glossary layer" }));

    expect(onToggleLayer).toHaveBeenCalledWith("glossary");
  });

  it("disables an empty layer's toggle with an explanatory tooltip, and never calls onToggleLayer (AC-6)", () => {
    const onToggleLayer = vi.fn();
    render(
      <LayerPanel
        layerStatus={{ glossary: "off", brand: "empty", governance: "off" } as Record<string, LayerStatus>}
        onToggleLayer={onToggleLayer}
      />
    );

    const brandToggle = screen.getByRole("switch", { name: "Toggle Brand layer" });
    expect(brandToggle).toBeDisabled();
    expect(brandToggle).toHaveAttribute("title", "No Brand content");

    fireEvent.click(brandToggle);
    expect(onToggleLayer).not.toHaveBeenCalled();
  });
});
