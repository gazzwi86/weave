import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useNodeSpotlight } from "../use-node-spotlight";

function fakeAdapter(
  overrides: Partial<RendererAdapter> = {},
): RendererAdapter {
  return {
    load: vi.fn(),
    getViewport: vi.fn(() => ({ zoom: 1, pan: { x: 0, y: 0 } })),
    setLayout: vi.fn(),
    spotlightNode: vi.fn(() => true),
    resetOpacity: vi.fn(),
    highlightNodes: vi.fn(),
    onNodeTap: vi.fn(() => vi.fn()),
    onBackgroundTap: vi.fn(() => vi.fn()),
    onNodeRightClick: vi.fn(() => vi.fn()),
    getNodeData: vi.fn(() => ({
      label: "Customer Onboarding",
      bpmoKind: "Process",
    })),
    listNodes: vi.fn(() => []),
    centerOn: vi.fn(),
    onNodeDragEnd: vi.fn(() => vi.fn()),
    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    ...overrides,
  };
}

function capture(adapter: RendererAdapter) {
  let nodeTapHandler: ((nodeId: string) => void) | undefined;
  let backgroundTapHandler: (() => void) | undefined;
  vi.mocked(adapter.onNodeTap).mockImplementation((handler) => {
    nodeTapHandler = handler;
    return vi.fn();
  });
  vi.mocked(adapter.onBackgroundTap).mockImplementation((handler) => {
    backgroundTapHandler = handler;
    return vi.fn();
  });
  return {
    tapNode: (id: string) => nodeTapHandler?.(id),
    tapBackground: () => backgroundTapHandler?.(),
  };
}

describe("useNodeSpotlight", () => {
  // AC-1: node click spotlights immediately (before CE resolves) using the
  // already-loaded label/type from the renderer adapter.
  it("spotlights the tapped node at the configured dim opacity and opens the panel in 'loading' with its already-loaded label/type", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const fetchNodeProps = vi.fn(() => new Promise<never>(() => {})); // never resolves in this test

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("n1");

    await waitFor(() =>
      expect(result.current.panel).toEqual({
        status: "loading",
        label: "Customer Onboarding",
        typeLabel: "Process",
      }),
    );
    expect(adapter.spotlightNode).toHaveBeenCalledWith(
      "n1",
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity,
    );
  });

  it("does nothing when the tapped node id is unknown/stale (spotlightNode returns false)", async () => {
    const adapter = fakeAdapter({ spotlightNode: vi.fn(() => false) });
    const events = capture(adapter);
    const fetchNodeProps = vi.fn();

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("stale");

    expect(result.current.panel).toEqual({ status: "closed" });
    expect(fetchNodeProps).not.toHaveBeenCalled();
  });

  // AC-2: no raw IRI for a viewer -- the panel only ever receives what the
  // proxy route decided to send (rawIri: null here).
  it("does NOT include a raw IRI in the loaded panel state for a viewer role", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const fetchNodeProps = vi.fn(async () => ({
      type: "ok" as const,
      data: { label: "Customer Onboarding", typeLabel: "Process", keyProperties: [], rawIri: null, neighbours: [] },
    }));

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("n1");

    await waitFor(() => expect(result.current.panel.status).toBe("loaded"));
    expect(result.current.panel).toMatchObject({ rawIri: null });
  });

  // AC-2: the ontologist role gets the raw IRI (server already decided this
  // via the proxy route -- the hook just passes through whatever it receives).
  it("includes the raw IRI in the loaded panel state for an ontologist role", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const iri = "https://weave.example/entity/cust-onboarding";
    const fetchNodeProps = vi.fn(async () => ({
      type: "ok" as const,
      data: { label: "Customer Onboarding", typeLabel: "Process", keyProperties: [], rawIri: iri, neighbours: [] },
    }));

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("n1");

    await waitFor(() => expect(result.current.panel.status).toBe("loaded"));
    expect(result.current.panel).toMatchObject({ rawIri: iri });
  });

  // TASK-005 AC-3: the loaded panel carries the tapped node's id and its
  // fetched neighbours through -- the neighbour-expansion hook reuses this
  // same data instead of issuing a second CE-READ-1 call.
  it("includes the node id and fetched neighbours in the loaded panel state", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const neighbours = [
      {
        iri: "https://weave.example/entity/invoice-1",
        label: "Invoice 1",
        bpmoKind: "DataAsset",
        edgePredicate: "https://weave.example/ontology/bpmo#relatesTo",
        edgeDirection: "outgoing" as const,
      },
    ];
    const fetchNodeProps = vi.fn(async () => ({
      type: "ok" as const,
      data: { label: "Customer Onboarding", typeLabel: "Process", keyProperties: [], rawIri: null, neighbours },
    }));

    const { result } = renderHook(() => useNodeSpotlight({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchNodeProps }));
    events.tapNode("n1");

    await waitFor(() => expect(result.current.panel.status).toBe("loaded"));
    expect(result.current.panel).toMatchObject({ nodeId: "n1", neighbours });
  });

  // AC-3: a generic CE error/timeout keeps the already-loaded label/type and
  // appends the "Details unavailable" fallback -- never blank, never a throw.
  it("falls back to the already-loaded label/type with an error notice on a non-404 CE failure", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const fetchNodeProps = vi.fn(async () => ({
      type: "error" as const,
      status: 503,
    }));

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("n1");

    await waitFor(() => expect(result.current.panel.status).toBe("error"));
    expect(result.current.panel).toEqual({
      status: "error",
      label: "Customer Onboarding",
      typeLabel: "Process",
    });
  });

  // AC-8: a 404 (cross-tenant or genuinely missing) is "Not found" -- distinct
  // from AC-3's generic fallback, and never carries any loaded label/type.
  it("shows 'not-found' (not the generic error fallback) on a 404", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const fetchNodeProps = vi.fn(async () => ({
      type: "error" as const,
      status: 404,
    }));

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("n1");

    await waitFor(() =>
      expect(result.current.panel).toEqual({ status: "not-found" }),
    );
  });

  // AC-4: background click restores opacity and closes the panel.
  it("resets opacity and closes the panel on a background tap", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const fetchNodeProps = vi.fn(() => new Promise<never>(() => {}));

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("n1");
    await waitFor(() => expect(result.current.panel.status).toBe("loading"));

    act(() => events.tapBackground());

    expect(adapter.resetOpacity).toHaveBeenCalled();
    expect(result.current.panel).toEqual({ status: "closed" });
  });

  // AC-4: Escape restores opacity and closes the panel.
  it("resets opacity and closes the panel on Escape", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const fetchNodeProps = vi.fn(() => new Promise<never>(() => {}));

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("n1");
    await waitFor(() => expect(result.current.panel.status).toBe("loading"));

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(adapter.resetOpacity).toHaveBeenCalled();
    expect(result.current.panel).toEqual({ status: "closed" });
  });

  it("retry() re-fetches properties for the last spotlighted node", async () => {
    const adapter = fakeAdapter();
    const events = capture(adapter);
    const fetchNodeProps = vi
      .fn()
      .mockResolvedValueOnce({ type: "error", status: 503 })
      .mockResolvedValueOnce({
        type: "ok",
        data: { label: "Customer Onboarding", typeLabel: "Process", keyProperties: [], rawIri: null, neighbours: [] },
      });

    const { result } = renderHook(() =>
      useNodeSpotlight({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchNodeProps,
      }),
    );
    events.tapNode("n1");
    await waitFor(() => expect(result.current.panel.status).toBe("error"));

    result.current.retry();

    await waitFor(() => expect(result.current.panel.status).toBe("loaded"));
    expect(fetchNodeProps).toHaveBeenCalledTimes(2);
    expect(fetchNodeProps).toHaveBeenNthCalledWith(
      2,
      "n1",
      DEFAULT_EXPLORER_CONFIG.ceTimeoutMs,
    );
  });
});
