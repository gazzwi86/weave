import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { FetchDomainMembersResult } from "@/lib/explorer/fetch-domain-members";
import * as layoutClient from "@/lib/explorer/layout-client";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { ExplorerInteractions } from "../explorer-interactions";

vi.mock("@/lib/explorer/layout-client", async (importOriginal) => {
  const actual = await importOriginal<typeof layoutClient>();
  return { ...actual, saveLayoutPosition: vi.fn(), resetLayoutPositions: vi.fn() };
});

const GRAPH_ID = DEFAULT_EXPLORER_CONFIG.layoutGraphId;
const NO_RETRY_CONFIG = { ...DEFAULT_EXPLORER_CONFIG, layoutSaveRetryDelaysMs: [] };

function fakeAdapter(overrides: Partial<RendererAdapter> = {}): RendererAdapter {
  let rightClickHandler: ((nodeId: string, position: { x: number; y: number }) => void) | undefined;
  return {
    load: vi.fn(),
    getViewport: vi.fn(() => ({ zoom: 1, pan: { x: 0, y: 0 } })),
    setLayout: vi.fn(),
    spotlightNode: vi.fn(() => true),
    resetOpacity: vi.fn(),
    highlightNodes: vi.fn(),
    onNodeTap: vi.fn(() => vi.fn()),
    onBackgroundTap: vi.fn(() => vi.fn()),
    onNodeRightClick: vi.fn((handler) => {
      rightClickHandler = handler;
      return vi.fn();
    }),
    getNodeData: vi.fn(() => ({ label: "Finance", bpmoKind: "Domain" })),
    listNodes: vi.fn(() => []),
    centerOn: vi.fn(),
    onNodeDragEnd: vi.fn(() => vi.fn()),
    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    applyFilterVisibility: vi.fn(),
    // test helper, not part of RendererAdapter -- fires the captured handler
    fireRightClick: (nodeId: string, position: { x: number; y: number }) => rightClickHandler?.(nodeId, position),
    ...overrides,
  } as RendererAdapter & { fireRightClick: (nodeId: string, position: { x: number; y: number }) => void };
}

// TASK-004 AC-2/AC-4: reset-layout button + non-blocking save-failure toast,
// wired onto the ADR-001 renderer-adapter seam via useLayoutPersistence.
describe("ExplorerInteractions -- TASK-004 layout persistence", () => {
  it("clicking 'Reset layout' clears saved positions and re-randomizes fcose", async () => {
    vi.mocked(layoutClient.resetLayoutPositions).mockResolvedValue(undefined);
    const adapter = fakeAdapter();

    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} graphId={GRAPH_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));

    await waitFor(() => expect(layoutClient.resetLayoutPositions).toHaveBeenCalledWith(GRAPH_ID));
    expect(adapter.setLayout).toHaveBeenCalledWith(
      "fcose",
      expect.objectContaining({ randomize: true })
    );
  });

  it("shows a dismissible toast once a dragged node's save retries are exhausted", async () => {
    vi.mocked(layoutClient.saveLayoutPosition).mockRejectedValue(new Error("down"));
    let dragHandler: ((nodeId: string, position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onNodeDragEnd: vi.fn((handler) => {
        dragHandler = handler;
        return vi.fn();
      }),
    });

    render(<ExplorerInteractions adapter={adapter} config={NO_RETRY_CONFIG} graphId={GRAPH_ID} />);
    act(() => dragHandler?.("urn:weave:x:1", { x: 5, y: 9 }));

    const toast = await screen.findByRole("alert");
    expect(toast).toHaveTextContent(/couldn.t save/i);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

const fetchNodeProps = vi.fn(async () => ({
  type: "ok" as const,
  data: {
    label: "Invoicing",
    typeLabel: "Process",
    keyProperties: [],
    rawIri: null,
    neighbours: [{ iri: "n2", label: "Payments", bpmoKind: "Process", edgePredicate: "p", edgeDirection: "outgoing" as const }],
  },
}));

describe("ExplorerInteractions", () => {
  // AC-3/AC-5: right-click a spotlighted node opens the context menu.
  it("opens the context menu on right-click of the currently spotlighted node", async () => {
    const adapter = fakeAdapter();
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} fetchNodeProps={fetchNodeProps} />);

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));

    act(() => (adapter as unknown as { fireRightClick: (id: string, p: { x: number; y: number }) => void }).fireRightClick("n1", { x: 5, y: 6 }));

    expect(screen.getByRole("menu", { name: "Node actions" })).toBeInTheDocument();
  });

  // AC-1: selecting "Focus domain" calls useDomainFocus's focusDomain.
  it("calls focusDomain with the node id when 'Focus domain' is selected", async () => {
    const adapter = fakeAdapter();
    const domainFetch = vi.fn(async (): Promise<FetchDomainMembersResult> => ({ type: "ok", rows: [] }));
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
        fetchDomainMembers={domainFetch}
      />
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() => (adapter as unknown as { fireRightClick: (id: string, p: { x: number; y: number }) => void }).fireRightClick("n1", { x: 5, y: 6 }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Focus domain" }));

    expect(domainFetch).toHaveBeenCalledWith("n1", DEFAULT_EXPLORER_CONFIG.domainMembershipPredicate, DEFAULT_EXPLORER_CONFIG.ceTimeoutMs);
  });

  // AC-3/AC-4: selecting "Expand neighbours" reuses the panel's already
  // fetched neighbours -- no new CE-READ-1 call.
  it("calls expandNode with the spotlighted node's already-fetched neighbours when 'Expand neighbours' is selected", async () => {
    const adapter = fakeAdapter({ getNodeData: vi.fn(() => ({ label: "Invoicing", bpmoKind: "Process" })) });
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} fetchNodeProps={fetchNodeProps} />);

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() => (adapter as unknown as { fireRightClick: (id: string, p: { x: number; y: number }) => void }).fireRightClick("n1", { x: 5, y: 6 }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Expand neighbours" }));

    expect(adapter.expandNode).toHaveBeenCalledWith("n1", [
      { iri: "n2", label: "Payments", bpmoKind: "Process", edgePredicate: "p", edgeDirection: "outgoing" },
    ]);
  });

  // AC-5: selecting "Collapse neighbours" calls collapseNode directly.
  it("calls collapseNode when 'Collapse neighbours' is selected", async () => {
    const adapter = fakeAdapter({
      getNodeData: vi.fn(() => ({ label: "Invoicing", bpmoKind: "Process" })),
      hasExpandedNeighbours: vi.fn(() => true),
    });
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} fetchNodeProps={fetchNodeProps} />);

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() => (adapter as unknown as { fireRightClick: (id: string, p: { x: number; y: number }) => void }).fireRightClick("n1", { x: 5, y: 6 }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Collapse neighbours" }));

    expect(adapter.collapseNode).toHaveBeenCalledWith("n1");
  });

  // AC-2/AC-9: the domain-focus empty-state and error notices surface
  // through the same composed component, driven by useDomainFocus's state.
  it("shows the empty-state notice when a domain focus returns zero members", async () => {
    const adapter = fakeAdapter();
    const domainFetch = vi.fn(async (): Promise<FetchDomainMembersResult> => ({ type: "ok", rows: [] }));
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
        fetchDomainMembers={domainFetch}
      />
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() => (adapter as unknown as { fireRightClick: (id: string, p: { x: number; y: number }) => void }).fireRightClick("n1", { x: 5, y: 6 }));

    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "Focus domain" })));

    expect(await screen.findByText("This domain has no members")).toBeInTheDocument();
  });

  it("shows a dismissable error notice with Retry when a domain focus fetch fails", async () => {
    const adapter = fakeAdapter();
    const domainFetch = vi.fn(async (): Promise<FetchDomainMembersResult> => ({ type: "error", status: 503 }));
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
        fetchDomainMembers={domainFetch}
      />
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() => (adapter as unknown as { fireRightClick: (id: string, p: { x: number; y: number }) => void }).fireRightClick("n1", { x: 5, y: 6 }));

    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "Focus domain" })));

    expect(await screen.findByText("CE error 503")).toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })));
    expect(domainFetch).toHaveBeenCalledTimes(2);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Dismiss" })));
    expect(screen.queryByText("CE error 503")).not.toBeInTheDocument();
  });

  // AC-4: over-threshold expand opens the confirm dialog instead of
  // mutating the canvas; Continue applies it, Cancel leaves it untouched.
  it("opens the confirm dialog for an over-threshold expand, and Continue applies it", async () => {
    const manyNeighbours = Array.from({ length: 5 }, (_, i) => ({
      iri: `n${i + 2}`,
      label: `Node ${i}`,
      bpmoKind: "Process",
      edgePredicate: "p",
      edgeDirection: "outgoing" as const,
    }));
    const fetchWithManyNeighbours = vi.fn(async () => ({
      type: "ok" as const,
      data: { label: "Invoicing", typeLabel: "Process", keyProperties: [], rawIri: null, neighbours: manyNeighbours },
    }));
    const config = { ...DEFAULT_EXPLORER_CONFIG, expandConfirmThreshold: 2 };
    const adapter = fakeAdapter({ getNodeData: vi.fn(() => ({ label: "Invoicing", bpmoKind: "Process" })) });
    render(<ExplorerInteractions adapter={adapter} config={config} fetchNodeProps={fetchWithManyNeighbours} />);

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() => (adapter as unknown as { fireRightClick: (id: string, p: { x: number; y: number }) => void }).fireRightClick("n1", { x: 5, y: 6 }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Expand neighbours" }));

    expect(screen.getByText("Load 5 more nodes?")).toBeInTheDocument();
    expect(adapter.expandNode).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(adapter.expandNode).toHaveBeenCalledWith("n1", manyNeighbours);
  });
});

// Deep-link focus: /explorer?focus=<iri> waits for the async graph load
// (polls getNodeData) before centering + spotlighting the node.
describe("ExplorerInteractions -- ?focus= deep link", () => {
  it("polls until the focus node exists, then centers and spotlights it", async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/explorer?focus=n1");
    // Absent for the first two polls, present from the third.
    const getNodeData = vi
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
      .mockReturnValue({ label: "Invoicing", bpmoKind: "Process" });
    const adapter = fakeAdapter({ getNodeData });

    try {
      render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} />);
      expect(adapter.centerOn).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(adapter.centerOn).toHaveBeenCalledWith("n1", DEFAULT_EXPLORER_CONFIG.centreAnimationMs);

      // Poll stops after success -- no repeat centering on later ticks.
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(adapter.centerOn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      window.history.replaceState(null, "", "/");
    }
  });

  it("gives up silently when the focus node never loads", async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/explorer?focus=ghost");
    const adapter = fakeAdapter({ getNodeData: vi.fn(() => undefined) });

    try {
      render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} />);
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });
      expect(adapter.centerOn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      window.history.replaceState(null, "", "/");
    }
  });
});
