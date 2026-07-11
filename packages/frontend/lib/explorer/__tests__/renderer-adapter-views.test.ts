import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter } from "../renderer-adapter";

import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-026 AC-1/AC-2/AC-7: saved-view viewport/position capture-restore and
// the poll-merge seam -- deliberately a sibling module (renderer-adapter.ts
// already carries a Law E file-cap waiver from TASK-020), same shape as
// renderer-adapter-colour.ts/renderer-adapter-diff.ts (standalone `*On(cy,
// ...)` fns, thin delegators wired into createRendererAdapter).
describe("createRendererAdapter -- TASK-026 view/position seam", () => {
  it("setViewport() writes zoom and pan back onto the renderer", () => {
    const cy = fakeCy();
    const adapter = createRendererAdapter(cy);

    adapter.setViewport({ zoom: 2, pan: { x: 5, y: 9 } });

    expect(cy.zoom).toHaveBeenCalledWith(2);
    expect(cy.pan).toHaveBeenCalledWith({ x: 5, y: 9 });
  });

  it("allNodePositions() returns every node's position keyed by id", () => {
    const cy = fakeCy();
    const n1 = fakeCollection({ id: vi.fn(() => "n1"), position: vi.fn(() => ({ x: 1, y: 2 })) });
    const n2 = fakeCollection({ id: vi.fn(() => "n2"), position: vi.fn(() => ({ x: 3, y: 4 })) });
    cy.nodes.mockReturnValue(fakeCollection({ map: (fn) => [fn(n1), fn(n2)] }));
    const adapter = createRendererAdapter(cy);
    const positions = adapter.allNodePositions();
    expect(positions).toEqual({ n1: { x: 1, y: 2 }, n2: { x: 3, y: 4 } });
  });

  it("applyPositions() sets position only on nodes present on the canvas, in one batch", () => {
    const cy = fakeCy();
    const present = fakeCollection({ length: 1 });
    cy.getElementById.mockImplementation((id: string) => (id === "n1" ? present : fakeCollection({ length: 0 })));
    const adapter = createRendererAdapter(cy);

    adapter.applyPositions({ n1: { x: 1, y: 2 }, missing: { x: 9, y: 9 } });

    expect(present.position).toHaveBeenCalledWith({ x: 1, y: 2 });
    expect(cy.batch).toHaveBeenCalledTimes(1);
  });
});

describe("createRendererAdapter -- TASK-026 AC-7 poll-merge seam", () => {
  it("mergeInPlace() adds elements not yet on the canvas", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 0 }));
    const adapter = createRendererAdapter(cy);
    const delta = [{ data: { id: "new1", label: "New" } }];

    adapter.mergeInPlace(delta, []);

    expect(cy.add).toHaveBeenCalledWith(delta);
  });

  it("mergeInPlace() refreshes data on an already-present element instead of re-adding it", () => {
    const cy = fakeCy();
    const existing = fakeCollection({ length: 1 });
    cy.getElementById.mockReturnValue(existing);
    const adapter = createRendererAdapter(cy);
    const delta = [{ data: { id: "n1", label: "Updated" } }];

    adapter.mergeInPlace(delta, []);

    expect(existing.data).toHaveBeenCalledWith("id", "n1");
    expect(existing.data).toHaveBeenCalledWith("label", "Updated");
    expect(cy.add).not.toHaveBeenCalled();
  });

  it("mergeInPlace() never touches a preserved (mid-drag) element's data", () => {
    const cy = fakeCy();
    const existing = fakeCollection({ length: 1 });
    cy.getElementById.mockReturnValue(existing);
    const adapter = createRendererAdapter(cy);
    const delta = [{ data: { id: "n1", label: "Updated" } }];

    adapter.mergeInPlace(delta, ["n1"]);

    expect(existing.data).not.toHaveBeenCalled();
  });
});
