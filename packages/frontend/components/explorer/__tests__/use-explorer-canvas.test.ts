import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CeReadError } from "@/lib/explorer/ce-read-error";
import { useExplorerCanvas } from "../use-explorer-canvas";

const PALETTE = [{ id: "Process", label: "Process", colour: "#3B82F6" }];
const ELEMENTS = [{ data: { id: "n1", label: "Customer Onboarding", bpmo_kind: "Process" } }];
const CE_ERROR_MESSAGE = "CE error 503";

function fakeCy() {
  return {
    container: vi.fn(() => document.createElement("div")),
    json: vi.fn(),
    layout: vi.fn(() => ({ run: vi.fn() })),
    zoom: vi.fn(() => 1),
    pan: vi.fn(() => ({ x: 0, y: 0 })),
    extent: vi.fn(() => ({ x1: 0, y1: 0, x2: 0, y2: 0 })),
    elements: vi.fn(() => ({ boundingBox: () => ({ x1: 0, y1: 0, x2: 0, y2: 0 }) })),
    on: vi.fn(),
    fit: vi.fn(),
    nodes: vi.fn(() => ({ style: vi.fn() })),
    edges: vi.fn(() => ({ style: vi.fn() })),
    destroy: vi.fn(),
  };
}

describe("useExplorerCanvas", () => {
  it("starts loading, then loads the palette+graph and constructs the canvas (AC-1)", async () => {
    const fetchPalette = vi.fn(async () => PALETTE);
    const fetchGraph = vi.fn(async () => ELEMENTS);
    const createCy = vi.fn(fakeCy);

    const { result } = renderHook(() =>
      useExplorerCanvas({ fetchPalette, fetchGraph, createCy })
    );

    expect(result.current.loadState).toBe("loading");
    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    expect(createCy).toHaveBeenCalledTimes(1);
    // ADR-001: canvas creation routes through renderer-adapter, not a direct
    // cytoscape constructor call -- elements load via adapter.load() (cy.json),
    // not a 3rd createCy argument (QA FIX 2).
    expect(createCy).toHaveBeenCalledWith(null, expect.anything());
    const cyInstance = createCy.mock.results[0]?.value as ReturnType<typeof fakeCy>;
    expect(cyInstance.json).toHaveBeenCalledWith({ elements: ELEMENTS });
    expect(cyInstance.layout).toHaveBeenCalledWith(expect.objectContaining({ name: "fcose" }));
  });

  it("shows the CE error message and never constructs the canvas on failure (AC-2)", async () => {
    const fetchPalette = vi.fn(async () => PALETTE);
    const fetchGraph = vi.fn(async () => {
      throw new CeReadError(CE_ERROR_MESSAGE);
    });
    const createCy = vi.fn(fakeCy);

    const { result } = renderHook(() =>
      useExplorerCanvas({ fetchPalette, fetchGraph, createCy })
    );

    await waitFor(() => expect(result.current.loadState).toBe("error"));

    expect(result.current.errorMessage).toBe(CE_ERROR_MESSAGE);
    expect(createCy).not.toHaveBeenCalled();
  });

  // QA edge case: a legitimately empty workspace graph (zero rows, no CE
  // error) must still reach "ready" and construct the canvas with an empty
  // element set -- AC-2's empty-state is for a CE *error*, not a valid-but-
  // empty graph, so these two zero-node paths must not be conflated.
  it("reaches ready (not error) and constructs the canvas with zero elements for an empty graph", async () => {
    const fetchPalette = vi.fn(async () => PALETTE);
    const fetchGraph = vi.fn(async () => []);
    const createCy = vi.fn(fakeCy);

    const { result } = renderHook(() =>
      useExplorerCanvas({ fetchPalette, fetchGraph, createCy })
    );

    await waitFor(() => expect(result.current.loadState).toBe("ready"));

    expect(result.current.errorMessage).toBeNull();
    const cyInstance = createCy.mock.results[0]?.value as ReturnType<typeof fakeCy>;
    expect(cyInstance.json).toHaveBeenCalledWith({ elements: [] });
  });

  it("retry() re-attempts the load after a failure", async () => {
    const fetchPalette = vi.fn(async () => PALETTE);
    const fetchGraph = vi
      .fn()
      .mockRejectedValueOnce(new CeReadError(CE_ERROR_MESSAGE))
      .mockResolvedValueOnce(ELEMENTS);
    const createCy = vi.fn(fakeCy);

    const { result } = renderHook(() =>
      useExplorerCanvas({ fetchPalette, fetchGraph, createCy })
    );

    await waitFor(() => expect(result.current.loadState).toBe("error"));

    result.current.retry();

    await waitFor(() => expect(result.current.loadState).toBe("ready"));
    expect(createCy).toHaveBeenCalledTimes(1);
  });
});
