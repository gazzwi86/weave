import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter } from "../renderer-adapter";

function fakeCy() {
  return {
    json: vi.fn(),
    zoom: vi.fn(() => 1.5),
    pan: vi.fn(() => ({ x: 10, y: 20 })),
    layout: vi.fn(() => ({ run: vi.fn() })),
  };
}

// ADR-001: TASK-002 builds only the subset of the render-adapter surface it
// needs now (load, getViewport, setLayout) -- onNodeClick/pin land with the
// tasks that need them (TASK-003/TASK-004), so a future WebGL swap only
// touches this seam.
describe("createRendererAdapter", () => {
  it("load() replaces the underlying renderer's element set", () => {
    const cy = fakeCy();
    const adapter = createRendererAdapter(cy);

    const elements = [{ data: { id: "n1" } }];
    adapter.load(elements);

    expect(cy.json).toHaveBeenCalledWith({ elements });
  });

  it("getViewport() reads the current zoom and pan from the renderer", () => {
    const cy = fakeCy();
    const adapter = createRendererAdapter(cy);

    expect(adapter.getViewport()).toEqual({ zoom: 1.5, pan: { x: 10, y: 20 } });
  });

  it("setLayout() runs a named layout with the given params", () => {
    const cy = fakeCy();
    const adapter = createRendererAdapter(cy);
    const run = vi.fn();
    cy.layout.mockReturnValue({ run });

    adapter.setLayout("fcose", { animate: true });

    expect(cy.layout).toHaveBeenCalledWith({ name: "fcose", animate: true });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
