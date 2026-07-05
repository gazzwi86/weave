import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter, type CyCollection } from "../renderer-adapter";

function fakeCollection(overrides: Partial<CyCollection> = {}): CyCollection {
  return {
    id: vi.fn(() => "n1"),
    data: vi.fn(() => undefined),
    style: vi.fn(),
    not: vi.fn(() => fakeCollection()),
    length: 1,
    map: vi.fn(() => []),
    closedNeighborhood: vi.fn(() => fakeCollection()),
    position: vi.fn(() => ({ x: 0, y: 0 })),
    ...overrides,
  };
}

function fakeCy() {
  const listenersByEvent = new Map<string, Set<(evt: { target: unknown }) => void>>();
  function listenersFor(event: string): Set<(evt: { target: unknown }) => void> {
    let listeners = listenersByEvent.get(event);
    if (!listeners) {
      listeners = new Set();
      listenersByEvent.set(event, listeners);
    }
    return listeners;
  }
  return {
    json: vi.fn(),
    zoom: vi.fn(() => 1.5),
    pan: vi.fn(() => ({ x: 10, y: 20 })),
    layout: vi.fn(() => ({ run: vi.fn() })),
    elements: vi.fn(() => fakeCollection()),
    nodes: vi.fn(() => fakeCollection()),
    getElementById: vi.fn((_id: string) => fakeCollection()),
    on: vi.fn((event: string, handler: (evt: { target: unknown }) => void) => {
      listenersFor(event).add(handler);
    }),
    off: vi.fn((event: string, handler: (evt: { target: unknown }) => void) => {
      listenersFor(event).delete(handler);
    }),
    animate: vi.fn(),
    fireTap(target: unknown) {
      listenersFor("tap").forEach((handler) => handler({ target }));
    },
    fireDragFree(target: unknown) {
      listenersFor("dragfree").forEach((handler) => handler({ target }));
    },
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

// TASK-003 (AC-1/AC-4/AC-5/AC-6): spotlight + search-overlay operations,
// added to the same ADR-001 seam so a future WebGL swap only touches this
// adapter's implementation, never the hooks/components that call it.
describe("createRendererAdapter -- TASK-003 spotlight/search additions", () => {
  it("spotlightNode() dims every element outside the node's closed neighbourhood and restores the neighbourhood to full opacity", () => {
    const cy = fakeCy();
    const neighbourhood = fakeCollection();
    const node = fakeCollection({ length: 1, closedNeighborhood: vi.fn(() => neighbourhood) });
    const rest = fakeCollection();
    cy.getElementById.mockReturnValue(node);
    cy.elements.mockReturnValue(fakeCollection({ not: vi.fn(() => rest) }));

    const adapter = createRendererAdapter(cy);
    const found = adapter.spotlightNode("n1", 0.18);

    expect(found).toBe(true);
    expect(rest.style).toHaveBeenCalledWith({ opacity: 0.18 });
    expect(neighbourhood.style).toHaveBeenCalledWith({ opacity: 1 });
  });

  it("spotlightNode() returns false and touches nothing for an unknown node id", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 0 }));

    const adapter = createRendererAdapter(cy);
    const found = adapter.spotlightNode("missing", 0.18);

    expect(found).toBe(false);
    expect(cy.elements).not.toHaveBeenCalled();
  });

  it("resetOpacity() restores every element to full opacity", () => {
    const cy = fakeCy();
    const all = fakeCollection();
    cy.elements.mockReturnValue(all);

    createRendererAdapter(cy).resetOpacity();

    expect(all.style).toHaveBeenCalledWith({ opacity: 1 });
  });

  it("highlightNodes() dims every element then restores only the given node ids to full opacity", () => {
    const cy = fakeCy();
    const all = fakeCollection();
    const matchA = fakeCollection();
    const matchB = fakeCollection();
    cy.elements.mockReturnValue(all);
    cy.getElementById.mockImplementation((id: string) => (id === "a" ? matchA : matchB));

    createRendererAdapter(cy).highlightNodes(["a", "b"], 0.18);

    expect(all.style).toHaveBeenCalledWith({ opacity: 0.18 });
    expect(matchA.style).toHaveBeenCalledWith({ opacity: 1 });
    expect(matchB.style).toHaveBeenCalledWith({ opacity: 1 });
  });

  it("onNodeTap() fires with the tapped node's id, and ignores a background tap", () => {
    const cy = fakeCy();
    const node = fakeCollection({ id: vi.fn(() => "n1") });
    const adapter = createRendererAdapter(cy);
    const handler = vi.fn();

    adapter.onNodeTap(handler);
    cy.fireTap(node);
    cy.fireTap(cy); // background tap -- target is the core itself

    expect(handler).toHaveBeenCalledExactlyOnceWith("n1");
  });

  it("onNodeTap()'s returned unregister function stops future calls", () => {
    const cy = fakeCy();
    const node = fakeCollection();
    const adapter = createRendererAdapter(cy);
    const handler = vi.fn();

    const unregister = adapter.onNodeTap(handler);
    unregister();
    cy.fireTap(node);

    expect(handler).not.toHaveBeenCalled();
  });

  it("onBackgroundTap() fires only for a true background tap, not a node tap", () => {
    const cy = fakeCy();
    const node = fakeCollection();
    const adapter = createRendererAdapter(cy);
    const handler = vi.fn();

    adapter.onBackgroundTap(handler);
    cy.fireTap(node);
    cy.fireTap(cy);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("getNodeData() reads the already-loaded label/bpmoKind for a known node", () => {
    const cy = fakeCy();
    const node = fakeCollection({
      length: 1,
      data: vi.fn((key: string) => ({ label: "Customer Onboarding", bpmo_kind: "Process" })[key]),
    });
    cy.getElementById.mockReturnValue(node);

    expect(createRendererAdapter(cy).getNodeData("n1")).toEqual({
      label: "Customer Onboarding",
      bpmoKind: "Process",
    });
  });

  it("getNodeData() returns undefined for an unknown node id", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 0 }));

    expect(createRendererAdapter(cy).getNodeData("missing")).toBeUndefined();
  });

  it("listNodes() returns every loaded node's id/label/bpmoKind for client-side search (AC-5)", () => {
    const cy = fakeCy();
    const nodeData: Record<string, { id: string; label: string; bpmo_kind: string }> = {
      n1: { id: "n1", label: "Customer Onboarding", bpmo_kind: "Process" },
    };
    cy.nodes.mockReturnValue(
      fakeCollection({
        map: vi.fn((fn) =>
          Object.values(nodeData).map((data) =>
            fn({ id: () => data.id, data: (key: string) => (data as Record<string, string>)[key] })
          )
        ),
      })
    );

    expect(createRendererAdapter(cy).listNodes()).toEqual([
      { id: "n1", label: "Customer Onboarding", bpmoKind: "Process" },
    ]);
  });

  it("centerOn() animates the viewport to centre on the given node over durationMs", () => {
    const cy = fakeCy();
    const node = fakeCollection({ length: 1 });
    cy.getElementById.mockReturnValue(node);

    createRendererAdapter(cy).centerOn("n1", 300);

    expect(cy.animate).toHaveBeenCalledWith({ center: { eles: node } }, { duration: 300 });
  });

  it("centerOn() is a no-op for an unknown node id", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 0 }));

    createRendererAdapter(cy).centerOn("missing", 300);

    expect(cy.animate).not.toHaveBeenCalled();
  });
});

// TASK-004 AC-1: drag-persist wiring, added to the same ADR-001 seam so a
// future WebGL swap only touches this adapter's implementation.
describe("createRendererAdapter -- TASK-004 onNodeDragEnd", () => {
  it("onNodeDragEnd() fires with the dragged node's id and new position", () => {
    const cy = fakeCy();
    const node = fakeCollection({ id: vi.fn(() => "n1"), position: vi.fn(() => ({ x: 42, y: 7 })) });
    const adapter = createRendererAdapter(cy);
    const handler = vi.fn();

    adapter.onNodeDragEnd(handler);
    cy.fireDragFree(node);

    expect(handler).toHaveBeenCalledExactlyOnceWith("n1", { x: 42, y: 7 });
  });

  it("onNodeDragEnd()'s returned unregister function stops future calls", () => {
    const cy = fakeCy();
    const node = fakeCollection();
    const adapter = createRendererAdapter(cy);
    const handler = vi.fn();

    const unregister = adapter.onNodeDragEnd(handler);
    unregister();
    cy.fireDragFree(node);

    expect(handler).not.toHaveBeenCalled();
  });
});
