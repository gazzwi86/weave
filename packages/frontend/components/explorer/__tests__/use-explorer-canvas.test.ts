import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CeReadError } from "@/lib/explorer/ce-read-error";
import { useExplorerCanvas } from "../use-explorer-canvas";

const PALETTE = [{ id: "Process", label: "Process", colour: "#3B82F6" }];
const ELEMENTS = [{ data: { id: "n1", label: "Customer Onboarding", bpmo_kind: "Process" } }];

function fakeCy() {
  return {
    container: vi.fn(() => document.createElement("div")),
    json: vi.fn(),
    layout: vi.fn(() => ({ run: vi.fn() })),
    zoom: vi.fn(() => 1),
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
    expect(createCy).toHaveBeenCalledWith(expect.anything(), ELEMENTS, expect.anything());
  });

  it("shows the CE error message and never constructs the canvas on failure (AC-2)", async () => {
    const fetchPalette = vi.fn(async () => PALETTE);
    const fetchGraph = vi.fn(async () => {
      throw new CeReadError("CE error 503");
    });
    const createCy = vi.fn(fakeCy);

    const { result } = renderHook(() =>
      useExplorerCanvas({ fetchPalette, fetchGraph, createCy })
    );

    await waitFor(() => expect(result.current.loadState).toBe("error"));

    expect(result.current.errorMessage).toBe("CE error 503");
    expect(createCy).not.toHaveBeenCalled();
  });

  it("retry() re-attempts the load after a failure", async () => {
    const fetchPalette = vi.fn(async () => PALETTE);
    const fetchGraph = vi
      .fn()
      .mockRejectedValueOnce(new CeReadError("CE error 503"))
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
