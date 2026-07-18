import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { FetchDomainMembersResult } from "@/lib/explorer/fetch-domain-members";
import * as layoutClient from "@/lib/explorer/layout-client";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { CytoscapeElement, NodeKind } from "@/lib/explorer/types";

import { ExplorerInteractions } from "../explorer-interactions";

vi.mock("@/lib/explorer/layout-client", async (importOriginal) => {
  const actual = await importOriginal<typeof layoutClient>();
  return {
    ...actual,
    saveLayoutPosition: vi.fn(),
    resetLayoutPositions: vi.fn(),
  };
});

// useCanvasLegend's default fetchPalette hits the real CE-READ-1 proxy --
// stubbed globally so tests that don't care about the legend (most of this
// file) don't need their own fetchPalette prop just to avoid a network call.
vi.mock("@/lib/explorer/fetch-graph", () => ({
  fetchPalette: vi.fn(async () => []),
  fetchGraph: vi.fn(async () => []),
  fetchRelTypes: vi.fn(async () => []),
}));
vi.mock("@/lib/explorer/versions/fetch-versions", () => ({ fetchVersions: vi.fn(async () => ({ type: "ok", versions: [] })) }));
vi.mock("@/lib/explorer/versions/fetch-diff", () => ({ fetchDiff: vi.fn(async () => ({ type: "ok", diff: { added: [], removed: [], modified: [] } })) }));
vi.mock("@/lib/explorer/fetch-ontology-types", () => ({ fetchOntologyTypes: vi.fn(async () => ({ type: "ok", relationships: [] })) }));
// CommentsPanel (TASK-026 AC-6) fetches on mount via SidePanel -- stub so
// these pre-existing tests don't leak a real fetch() against a relative URL.
vi.mock("@/lib/explorer/comments-client", () => ({ listComments: vi.fn().mockResolvedValue([]), createComment: vi.fn() }));
// useEventPollWiring (TASK-026 AC-7) polls on mount while active (draft
// mode) -- stub so these pre-existing tests don't leak a real fetch().
vi.mock("@/lib/explorer/events-client", () => ({
  fetchEvents: vi.fn().mockResolvedValue({ status: 200, events: [], latest_seq: 0 }),
}));

const GRAPH_ID = DEFAULT_EXPLORER_CONFIG.layoutGraphId;
const NO_RETRY_CONFIG = {
  ...DEFAULT_EXPLORER_CONFIG,
  layoutSaveRetryDelaysMs: [],
};

function fakeAdapter(
  overrides: Partial<RendererAdapter> = {},
): RendererAdapter {
  let rightClickHandler:
    ((nodeId: string, position: { x: number; y: number }) => void) | undefined;
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
    onNodeDragEnd: vi.fn(() => vi.fn()),    onEdgeDrawComplete: vi.fn(() => vi.fn()),

    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    reconcileElement: vi.fn(),
    onBackgroundDoubleClick: vi.fn(),
    listElements: vi.fn(() => []),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),    setTraceHighlight: vi.fn(),
    clearTraceHighlight: vi.fn(),
    setDiffOverlay: vi.fn(),
    clearDiffOverlay: vi.fn(),
    setViewport: vi.fn(),
    allNodePositions: vi.fn(() => ({})),
    applyPositions: vi.fn(),
    mergeInPlace: vi.fn(),
    setBadges: vi.fn(),
    clearBadges: vi.fn(),    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyFilterVisibility: vi.fn(),
    // test helper, not part of RendererAdapter -- fires the captured handler
    fireRightClick: (nodeId: string, position: { x: number; y: number }) =>
      rightClickHandler?.(nodeId, position),
    ...overrides,
  } as RendererAdapter & {
    fireRightClick: (
      nodeId: string,
      position: { x: number; y: number },
    ) => void;
  };
}

// TASK-004 AC-2/AC-4: reset-layout button + non-blocking save-failure toast,
// wired onto the ADR-001 renderer-adapter seam via useLayoutPersistence.
describe("ExplorerInteractions -- TASK-004 layout persistence", () => {
  it("clicking 'Reset layout' clears saved positions and re-randomizes fcose", async () => {
    vi.mocked(layoutClient.resetLayoutPositions).mockResolvedValue(undefined);
    const adapter = fakeAdapter();

    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        graphId={GRAPH_ID}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));

    await waitFor(() =>
      expect(layoutClient.resetLayoutPositions).toHaveBeenCalledWith(GRAPH_ID),
    );
    expect(adapter.setLayout).toHaveBeenCalledWith(
      "fcose",
      expect.objectContaining({ randomize: true }),
    );
  });

  it("shows a dismissible toast once a dragged node's save retries are exhausted", async () => {
    vi.mocked(layoutClient.saveLayoutPosition).mockRejectedValue(
      new Error("down"),
    );
    let dragHandler:
      | ((nodeId: string, position: { x: number; y: number }) => void)
      | undefined;
    const adapter = fakeAdapter({
      onNodeDragEnd: vi.fn((handler) => {
        dragHandler = handler;
        return vi.fn();
      }),
    });

    render(
      <ExplorerInteractions
        adapter={adapter}
        config={NO_RETRY_CONFIG}
        graphId={GRAPH_ID}
      />,
    );
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
    neighbours: [
      {
        iri: "n2",
        label: "Payments",
        bpmoKind: "Process",
        edgePredicate: "p",
        edgeDirection: "outgoing" as const,
      },
    ],
  },
}));

describe("ExplorerInteractions", () => {
  // AC-3/AC-5: right-click a spotlighted node opens the context menu.
  it("opens the context menu on right-click of the currently spotlighted node", async () => {
    const adapter = fakeAdapter();
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
      />,
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));

    act(() =>
      (
        adapter as unknown as {
          fireRightClick: (id: string, p: { x: number; y: number }) => void;
        }
      ).fireRightClick("n1", { x: 5, y: 6 }),
    );

    expect(
      screen.getByRole("menu", { name: "Node actions" }),
    ).toBeInTheDocument();
  });

  // AC-1: selecting "Focus domain" calls useDomainFocus's focusDomain.
  it("calls focusDomain with the node id when 'Focus domain' is selected", async () => {
    const adapter = fakeAdapter();
    const domainFetch = vi.fn(async (): Promise<FetchDomainMembersResult> => ({
      type: "ok",
      rows: [],
    }));
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
        fetchDomainMembers={domainFetch}
      />,
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() =>
      (
        adapter as unknown as {
          fireRightClick: (id: string, p: { x: number; y: number }) => void;
        }
      ).fireRightClick("n1", { x: 5, y: 6 }),
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Focus domain" }));

    expect(domainFetch).toHaveBeenCalledWith(
      "n1",
      DEFAULT_EXPLORER_CONFIG.domainMembershipPredicate,
      DEFAULT_EXPLORER_CONFIG.ceTimeoutMs,
    );
  });

  // AC-3/AC-4: selecting "Expand neighbours" reuses the panel's already
  // fetched neighbours -- no new CE-READ-1 call.
  it("calls expandNode with the spotlighted node's already-fetched neighbours when 'Expand neighbours' is selected", async () => {
    const adapter = fakeAdapter({
      getNodeData: vi.fn(() => ({ label: "Invoicing", bpmoKind: "Process" })),
    });
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
      />,
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() =>
      (
        adapter as unknown as {
          fireRightClick: (id: string, p: { x: number; y: number }) => void;
        }
      ).fireRightClick("n1", { x: 5, y: 6 }),
    );

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Expand neighbours" }),
    );

    expect(adapter.expandNode).toHaveBeenCalledWith("n1", [
      {
        iri: "n2",
        label: "Payments",
        bpmoKind: "Process",
        edgePredicate: "p",
        edgeDirection: "outgoing",
      },
    ]);
  });

  // AC-5: selecting "Collapse neighbours" calls collapseNode directly.
  it("calls collapseNode when 'Collapse neighbours' is selected", async () => {
    const adapter = fakeAdapter({
      getNodeData: vi.fn(() => ({ label: "Invoicing", bpmoKind: "Process" })),
      hasExpandedNeighbours: vi.fn(() => true),
    });
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
      />,
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() =>
      (
        adapter as unknown as {
          fireRightClick: (id: string, p: { x: number; y: number }) => void;
        }
      ).fireRightClick("n1", { x: 5, y: 6 }),
    );

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Collapse neighbours" }),
    );

    expect(adapter.collapseNode).toHaveBeenCalledWith("n1");
  });

  // AC-2/AC-9: the domain-focus empty-state and error notices surface
  // through the same composed component, driven by useDomainFocus's state.
  it("shows the empty-state notice when a domain focus returns zero members", async () => {
    const adapter = fakeAdapter();
    const domainFetch = vi.fn(async (): Promise<FetchDomainMembersResult> => ({
      type: "ok",
      rows: [],
    }));
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
        fetchDomainMembers={domainFetch}
      />,
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() =>
      (
        adapter as unknown as {
          fireRightClick: (id: string, p: { x: number; y: number }) => void;
        }
      ).fireRightClick("n1", { x: 5, y: 6 }),
    );

    await act(async () =>
      fireEvent.click(screen.getByRole("menuitem", { name: "Focus domain" })),
    );

    expect(
      await screen.findByText("This domain has no members"),
    ).toBeInTheDocument();
  });

  it("shows a dismissable error notice with Retry when a domain focus fetch fails", async () => {
    const adapter = fakeAdapter();
    const domainFetch = vi.fn(async (): Promise<FetchDomainMembersResult> => ({
      type: "error",
      status: 503,
    }));
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
        fetchDomainMembers={domainFetch}
      />,
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() =>
      (
        adapter as unknown as {
          fireRightClick: (id: string, p: { x: number; y: number }) => void;
        }
      ).fireRightClick("n1", { x: 5, y: 6 }),
    );

    await act(async () =>
      fireEvent.click(screen.getByRole("menuitem", { name: "Focus domain" })),
    );

    expect(await screen.findByText("CE error 503")).toBeInTheDocument();

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Retry" })),
    );
    expect(domainFetch).toHaveBeenCalledTimes(2);

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" })),
    );
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
      data: {
        label: "Invoicing",
        typeLabel: "Process",
        keyProperties: [],
        rawIri: null,
        neighbours: manyNeighbours,
      },
    }));
    const config = { ...DEFAULT_EXPLORER_CONFIG, expandConfirmThreshold: 2 };
    const adapter = fakeAdapter({
      getNodeData: vi.fn(() => ({ label: "Invoicing", bpmoKind: "Process" })),
    });
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={config}
        fetchNodeProps={fetchWithManyNeighbours}
      />,
    );

    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap("n1"));
    act(() =>
      (
        adapter as unknown as {
          fireRightClick: (id: string, p: { x: number; y: number }) => void;
        }
      ).fireRightClick("n1", { x: 5, y: 6 }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Expand neighbours" }),
    );

    expect(screen.getByText("Load 5 more nodes?")).toBeInTheDocument();
    expect(adapter.expandNode).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(adapter.expandNode).toHaveBeenCalledWith("n1", manyNeighbours);
  });
});

// TASK-020: the search trigger moves into the shared CanvasToolbar shell,
// and the legend/filters panel mount alongside it -- both driven off the
// same adapter.listElements()/fetchPalette seams the filter/legend hooks
// already have unit coverage for.
describe("ExplorerInteractions -- TASK-020 filters/legend/toolbar mount", () => {
  const twoTypeNodes: CytoscapeElement[] = [
    { data: { id: "n1", bpmo_kind: "Process" } },
    { data: { id: "n2", bpmo_kind: "Policy" } },
  ];
  const palette: NodeKind[] = [
    { id: "process", label: "Process", colour: "var(--color-kind-process)" },
  ];
  const fetchPalette = vi.fn(async () => palette);

  it("moves the search trigger inside the canvas toolbar (D-3)", () => {
    const adapter = fakeAdapter();
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchPalette={fetchPalette}
      />,
    );

    expect(screen.getByTestId("explorer-toolbar")).toContainElement(
      screen.getByRole("button", { name: "Search nodes" }),
    );
  });

  it("renders the legend and the filters panel alongside the canvas", async () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoTypeNodes) });
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchPalette={fetchPalette}
      />,
    );

    expect(await screen.findByText("Process")).toBeInTheDocument();
    // Refit: the filters panel now lives behind the ControlDock's "Filters"
    // tab (single-open accordion, mock's `.dock`) rather than an
    // always-visible side panel.
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByTestId("explorer-filter-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Process" }),
    ).toBeInTheDocument();
  });

  it("shows the all-types-off empty-state instead of a blank canvas, and Retry restores every type (AC-2)", async () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoTypeNodes) });
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchPalette={fetchPalette}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Process" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Policy" }));

    expect(await screen.findByTestId("explorer-empty-state")).toHaveTextContent(
      /hidden/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      screen.queryByTestId("explorer-empty-state"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Process" })).toBeChecked();
  });

  it("shows the no-match empty-state when a property filter matches no loaded node, and Retry clears it (AC-5)", async () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoTypeNodes) });
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchPalette={fetchPalette}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("Property path"), {
      target: { value: "status" },
    });
    fireEvent.change(screen.getByLabelText("Value"), {
      target: { value: "no-such-value" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));

    expect(await screen.findByTestId("explorer-empty-state")).toHaveTextContent(
      /no loaded nodes match/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      screen.queryByTestId("explorer-empty-state"),
    ).not.toBeInTheDocument();
  });
});

// refit deferred item 1: the Overlays tab merges use-overlay-controls'
// colour toggles (heatmap/domain-colouring) with useCanvasOverlayToggles'
// completeness/impact/version-diff/change-heatmap rows -- one end-to-end
// check that the merge/dispatch in canvas-filter-chrome.tsx actually
// reaches the DOM, since neither hook is exercised together anywhere else.
describe("ExplorerInteractions -- refit deferred item 1: Overlays tab merge", () => {
  it("lists both the colour overlays and the new toggles under one Overlays tab", async () => {
    const adapter = fakeAdapter();
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchPalette={vi.fn(async () => [])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Overlays" }));

    expect(screen.getByRole("switch", { name: "Coverage gaps" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Impact of selection" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Version diff" })).toBeInTheDocument();
    const heatmapToggle = screen.getByRole("switch", { name: "Change heatmap (pending)" });
    expect(heatmapToggle).toBeDisabled();
    expect(heatmapToggle).toHaveAttribute("title", expect.stringMatching(/G17/));
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
      render(
        <ExplorerInteractions
          adapter={adapter}
          config={DEFAULT_EXPLORER_CONFIG}
        />,
      );
      expect(adapter.centerOn).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(adapter.centerOn).toHaveBeenCalledWith(
        "n1",
        DEFAULT_EXPLORER_CONFIG.centreAnimationMs,
      );

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
      render(
        <ExplorerInteractions
          adapter={adapter}
          config={DEFAULT_EXPLORER_CONFIG}
        />,
      );
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

// TASK-023 AC-3/AC-6/AC-7: quick-add and draw-edge are wired onto the real
// component tree, gated by the role/canvas-mode-derived canEdit flag --
// closes the "coded but never imported" integration gap this task's own
// escalation note flagged.
describe("ExplorerInteractions -- TASK-023 edit affordances", () => {
  function fakeAdapterWithDoubleClick(): RendererAdapter & { fireDoubleClick: (position: { x: number; y: number }) => void } {
    let handler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((h: (position: { x: number; y: number }) => void) => {
        handler = h;
        return vi.fn();
      }),
    });
    return Object.assign(adapter, {
      fireDoubleClick: (position: { x: number; y: number }) => handler?.(position),
    });
  }

  it("opens the quick-add popover on double-click for an editor role on the draft canvas", () => {
    const adapter = fakeAdapterWithDoubleClick();
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} role="business_analyst_sme" />);
    act(() => adapter.fireDoubleClick({ x: 10, y: 10 }));
    expect(screen.getByLabelText("Add node")).toBeInTheDocument();
  });

  it("never opens the quick-add popover for the viewer role", () => {
    const adapter = fakeAdapterWithDoubleClick();
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} role="viewer" />);
    act(() => adapter.fireDoubleClick({ x: 10, y: 10 }));
    expect(screen.queryByLabelText("Add node")).not.toBeInTheDocument();
  });

  it("never opens the quick-add popover when no role is present", () => {
    const adapter = fakeAdapterWithDoubleClick();
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} role={null} />);
    act(() => adapter.fireDoubleClick({ x: 10, y: 10 }));
    expect(screen.queryByLabelText("Add node")).not.toBeInTheDocument();
  });
});

// TASK-024 AC-1..AC-8: usePanelEdit mounted into the real SidePanel via
// ExplorerInteractions -- closes the "hook built, never mounted" gap the
// coordinator flagged. Reuses this file's fetchNodeProps fixture (one
// neighbour -> a 1-edge incident batch) and stubs the global fetch that
// postToWriteProxy (the default writeProxy) calls.
describe("ExplorerInteractions -- TASK-024 property edit + delete", () => {
  // save()'s drift re-check calls the real (non-injected) fetchNodeProps,
  // which requires an absolute IRI -- "n1" alone would 422 before ever
  // reaching fetch, so this node id is a urn: like the rest of the file.
  const NODE_IRI = "urn:weave:process:invoicing";

  async function openLoadedPanel(adapter: RendererAdapter) {
    render(
      <ExplorerInteractions
        adapter={adapter}
        config={DEFAULT_EXPLORER_CONFIG}
        fetchNodeProps={fetchNodeProps}
        role="business_analyst_sme"
      />
    );
    const onNodeTap = vi.mocked(adapter.onNodeTap).mock.calls[0]![0];
    await act(async () => onNodeTap(NODE_IRI));
    await screen.findByText("Invoicing");
  }

  beforeEach(async () => {
    const { resetDraftHeadForTests } = await import("@/lib/explorer/draft-head");
    resetDraftHeadForTests();
  });

  it("surfaces a conflict notice when the drift head advances between edit-start and save", async () => {
    const { bumpDraftHead } = await import("@/lib/explorer/draft-head");
    // The re-check inside save() calls the real (non-injected) CE-READ-1
    // fetch -- distinct from this file's fetchNodeProps prop, which only
    // feeds useNodeSpotlight's initial open.
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ label: "Invoicing (server)", type_label: "Process", key_properties: [], raw_iri: null, neighbours: [] }),
        { status: 200 }
      )
    );
    const adapter = fakeAdapter();
    await openLoadedPanel(adapter);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    bumpDraftHead(); // a second writer commits while this edit is open

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("This node changed since you started editing.")).toBeInTheDocument();
  });

  it("shows the incident-edge batch count and only commits delete after Continue is confirmed", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 201 })
    );
    const adapter = fakeAdapter();
    await openLoadedPanel(adapter);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("This removes the node and its 1 connected edge.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalledWith("/api/proxy/operations/apply", expect.anything()); // no write until confirmed

    const dialog = screen.getByRole("dialog", { name: "Delete this node?" });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Delete" })));

    expect(fetchSpy).toHaveBeenCalledWith("/api/proxy/operations/apply", expect.anything());
    expect(adapter.removeElements).toHaveBeenCalled();
  });

  it("leaves the canvas untouched and shows a failure toast when the delete request times out", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));
    const adapter = fakeAdapter();
    await openLoadedPanel(adapter);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this node?" });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Delete" })));

    expect(await screen.findByText("Delete failed -- canvas unchanged. Try again.")).toBeInTheDocument();
    expect(adapter.removeElements).not.toHaveBeenCalled();
  });
});
