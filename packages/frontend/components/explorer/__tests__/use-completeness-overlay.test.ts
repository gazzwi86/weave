import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OverlayEngine } from "@/lib/explorer/overlay-engine";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useCompletenessOverlay } from "../use-completeness-overlay";

function fakeAdapter(nodeIds: string[]): RendererAdapter {
  const known = new Set(nodeIds);
  return {
    getNodeData: vi.fn((id: string) => (known.has(id) ? { label: id, bpmoKind: "Process" } : undefined)),
    setBadges: vi.fn(),
    clearBadges: vi.fn(),
  } as unknown as RendererAdapter;
}

const GAP_ROWS = [{ entityIri: "entity-1", missingLink: "https://weave.example/ontology/bpmo#performedBy" }];

describe("useCompletenessOverlay", () => {
  it("activates the overlay with fetched rows and badges the canvas (AC-1)", async () => {
    const adapter = fakeAdapter(["entity-1"]);
    const engine = new OverlayEngine();
    const fetchCoverageGaps = vi.fn(async () => ({ type: "ok" as const, rows: GAP_ROWS }));
    const { result } = renderHook(() =>
      useCompletenessOverlay({ adapter, engine, timeoutMs: 5_000, fetchCoverageGaps, relationships: [] })
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(adapter.setBadges).toHaveBeenCalledWith({ "entity-1": 1 });
    expect(result.current.active).toBe(true);
    expect(engine.isActive("completeness")).toBe(true);
  });

  // AC-2
  it("shows a no-gaps confirmation and stays active when there are zero rows", async () => {
    const adapter = fakeAdapter([]);
    const engine = new OverlayEngine();
    const fetchCoverageGaps = vi.fn(async () => ({ type: "ok" as const, rows: [] }));
    const { result } = renderHook(() =>
      useCompletenessOverlay({ adapter, engine, timeoutMs: 5_000, fetchCoverageGaps, relationships: [] })
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.active).toBe(true);
    expect(result.current.notice).toBe("No coverage gaps found");
  });

  // AC-3
  it("leaves the canvas untouched and shows a retry notice on a query error", async () => {
    const adapter = fakeAdapter(["entity-1"]);
    const engine = new OverlayEngine();
    const fetchCoverageGaps = vi.fn(async () => ({ type: "error" as const, status: 503 }));
    const { result } = renderHook(() =>
      useCompletenessOverlay({ adapter, engine, timeoutMs: 5_000, fetchCoverageGaps, relationships: [] })
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(adapter.setBadges).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
    expect(result.current.error).toBe(true);
  });

  it("retries the same fetch on retry()", async () => {
    const adapter = fakeAdapter(["entity-1"]);
    const engine = new OverlayEngine();
    const fetchCoverageGaps = vi
      .fn()
      .mockResolvedValueOnce({ type: "error" as const, status: 503 })
      .mockResolvedValueOnce({ type: "ok" as const, rows: GAP_ROWS });
    const { result } = renderHook(() =>
      useCompletenessOverlay({ adapter, engine, timeoutMs: 5_000, fetchCoverageGaps, relationships: [] })
    );

    await act(async () => {
      await result.current.toggle();
    });
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.active).toBe(true);
    expect(adapter.setBadges).toHaveBeenCalledWith({ "entity-1": 1 });
  });

  // AC-7 diff-exclusion half
  it("deactivates an active diff overlay before activating completeness", async () => {
    const adapter = fakeAdapter(["entity-1"]);
    const engine = new OverlayEngine();
    engine.activate(
      { id: "diff", exclusiveGroup: "colour", apply: vi.fn(), remove: vi.fn(), legend: () => ({ title: "Diff", entries: [] }) },
      adapter
    );
    const fetchCoverageGaps = vi.fn(async () => ({ type: "ok" as const, rows: GAP_ROWS }));
    const { result } = renderHook(() =>
      useCompletenessOverlay({ adapter, engine, timeoutMs: 5_000, fetchCoverageGaps, relationships: [] })
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(engine.isActive("diff")).toBe(false);
    expect(engine.isActive("completeness")).toBe(true);
  });

  it("toggling off deactivates and clears badges", async () => {
    const adapter = fakeAdapter(["entity-1"]);
    const engine = new OverlayEngine();
    const fetchCoverageGaps = vi.fn(async () => ({ type: "ok" as const, rows: GAP_ROWS }));
    const { result } = renderHook(() =>
      useCompletenessOverlay({ adapter, engine, timeoutMs: 5_000, fetchCoverageGaps, relationships: [] })
    );

    await act(async () => {
      await result.current.toggle();
    });
    act(() => {
      result.current.toggle();
    });

    expect(result.current.active).toBe(false);
    expect(adapter.clearBadges).toHaveBeenCalled();
  });

  // AC-7: perf trace, mirrors use-overlay-controls-perf.test.ts's
  // __explorerOverlayApplyDurationMs -- Playwright-only wall-clock trace
  // of the single engine.activate call a toggle triggers, at up to 10k
  // gap-flagged nodes.
  it("records the activation's wall-clock duration on window.__explorerCompletenessApplyDurationMs", async () => {
    delete window.__explorerCompletenessApplyDurationMs;
    const bigRows = Array.from({ length: 10_000 }, (_, index) => ({
      entityIri: `entity-${index}`,
      missingLink: "https://weave.example/ontology/bpmo#performedBy",
    }));
    const adapter = fakeAdapter(bigRows.map((row) => row.entityIri));
    const engine = new OverlayEngine();
    const fetchCoverageGaps = vi.fn(async () => ({ type: "ok" as const, rows: bigRows }));
    const { result } = renderHook(() =>
      useCompletenessOverlay({ adapter, engine, timeoutMs: 5_000, fetchCoverageGaps, relationships: [] })
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(typeof window.__explorerCompletenessApplyDurationMs).toBe("number");
  });
});
