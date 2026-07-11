import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { NodeKind } from "@/lib/explorer/types";

import { useCanvasLegend } from "../use-canvas-legend";

const PALETTE: NodeKind[] = [{ id: "process", label: "Process", colour: "var(--color-kind-process)" }];

describe("useCanvasLegend", () => {
  it("starts loading and exposes the fetched palette once resolved (D-6)", async () => {
    const fetchPalette = vi.fn(() => Promise.resolve(PALETTE));
    const { result } = renderHook(() => useCanvasLegend(fetchPalette));

    expect(result.current.loading).toBe(true);
    expect(result.current.palette).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.palette).toEqual(PALETTE);
    expect(fetchPalette).toHaveBeenCalledTimes(1);
  });
});
