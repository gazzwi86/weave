import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { FetchDomainMembersResult } from "@/lib/explorer/fetch-domain-members";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useDomainFocus } from "../use-domain-focus";

function fakeAdapter(overrides: Partial<RendererAdapter> = {}): RendererAdapter {
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
    getNodeData: vi.fn(() => undefined),
    listNodes: vi.fn(() => []),
    centerOn: vi.fn(),
    onNodeDragEnd: vi.fn(() => vi.fn()),
    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    listElements: vi.fn(() => []),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),    setTraceHighlight: vi.fn(),
    clearTraceHighlight: vi.fn(),
    setDiffOverlay: vi.fn(),
    clearDiffOverlay: vi.fn(),
    setBadges: vi.fn(),
    clearBadges: vi.fn(),
    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyFilterVisibility: vi.fn(),
    ...overrides,
  };
}

const DOMAIN_IRI = "https://weave.example/domain/finance";

describe("useDomainFocus", () => {
  // AC-1: dims all non-member elements to the configured opacity and
  // restores member nodes to full opacity.
  it("dims the canvas and restores member nodes to full opacity on a successful fetch", async () => {
    const adapter = fakeAdapter();
    const fetchDomainMembers = vi.fn(
      async (): Promise<FetchDomainMembersResult> => ({
        type: "ok",
        rows: [{ entityIri: "https://weave.example/entity/invoice-1", entityLabel: "Invoice 1" }],
      })
    );

    const { result } = renderHook(() =>
      useDomainFocus({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchDomainMembers })
    );
    result.current.focusDomain(DOMAIN_IRI);

    await waitFor(() => expect(result.current.state).toEqual({ status: "focused" }));
    expect(fetchDomainMembers).toHaveBeenCalledWith(
      DOMAIN_IRI,
      DEFAULT_EXPLORER_CONFIG.domainMembershipPredicate,
      DEFAULT_EXPLORER_CONFIG.ceTimeoutMs
    );
    expect(adapter.highlightNodes).toHaveBeenCalledWith(
      ["https://weave.example/entity/invoice-1"],
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity
    );
  });

  // AC-2: zero member rows -> empty-state, canvas stays de-emphasised (dim
  // all, restore nothing).
  it("shows the empty state and dims the whole canvas when the domain has no members", async () => {
    const adapter = fakeAdapter();
    const fetchDomainMembers = vi.fn(async (): Promise<FetchDomainMembersResult> => ({ type: "ok", rows: [] }));

    const { result } = renderHook(() =>
      useDomainFocus({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchDomainMembers })
    );
    result.current.focusDomain(DOMAIN_IRI);

    await waitFor(() => expect(result.current.state).toEqual({ status: "empty" }));
    expect(adapter.highlightNodes).toHaveBeenCalledWith([], DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity);
  });

  // AC-1 (error path) + AC-9: CE-READ-1 failure restores full opacity and
  // shows a dismissable error notice with retry; canvas elements otherwise
  // unchanged.
  it("restores full opacity and surfaces a retryable error on a CE-READ-1 failure", async () => {
    const adapter = fakeAdapter();
    const fetchDomainMembers = vi.fn(async (): Promise<FetchDomainMembersResult> => ({ type: "error", status: 503 }));

    const { result } = renderHook(() =>
      useDomainFocus({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchDomainMembers })
    );
    result.current.focusDomain(DOMAIN_IRI);

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(adapter.resetOpacity).toHaveBeenCalled();
    expect(adapter.highlightNodes).not.toHaveBeenCalled();
  });

  it("retries the last domain focus request", async () => {
    const adapter = fakeAdapter();
    const fetchDomainMembers = vi
      .fn<() => Promise<FetchDomainMembersResult>>()
      .mockResolvedValueOnce({ type: "error", status: 503 })
      .mockResolvedValueOnce({ type: "ok", rows: [] });

    const { result } = renderHook(() =>
      useDomainFocus({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchDomainMembers })
    );
    result.current.focusDomain(DOMAIN_IRI);
    await waitFor(() => expect(result.current.state.status).toBe("error"));

    result.current.retry();

    await waitFor(() => expect(result.current.state).toEqual({ status: "empty" }));
    expect(fetchDomainMembers).toHaveBeenCalledTimes(2);
  });

  it("dismisses the error notice without touching the canvas", async () => {
    const adapter = fakeAdapter();
    const fetchDomainMembers = vi.fn(async (): Promise<FetchDomainMembersResult> => ({ type: "error", status: 503 }));

    const { result } = renderHook(() =>
      useDomainFocus({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchDomainMembers })
    );
    result.current.focusDomain(DOMAIN_IRI);
    await waitFor(() => expect(result.current.state.status).toBe("error"));

    result.current.dismissError();

    await waitFor(() => expect(result.current.state).toEqual({ status: "inactive" }));
    expect(adapter.resetOpacity).toHaveBeenCalledTimes(1); // only the error path's restore, not a second one from dismiss
  });
});
