import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import { resetDraftHeadForTests } from "@/lib/explorer/draft-head";
import type { WriteProxyFn, WriteProxyResult } from "@/lib/explorer/edit-controller";
import type { FetchNodePropsResult } from "@/lib/explorer/fetch-node-props";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import type { SidePanelState } from "../use-node-spotlight";
import { usePanelEdit } from "../use-panel-edit";

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
    onBackgroundDoubleClick: vi.fn(() => vi.fn()),
    onEdgeDrawComplete: vi.fn(() => vi.fn()),
    getNodeData: vi.fn(() => ({ label: "Onboarding", bpmoKind: "Process" })),
    listNodes: vi.fn(() => []),
    listElements: vi.fn(() => []),
    centerOn: vi.fn(),
    onNodeDragEnd: vi.fn(() => vi.fn()),
    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    reconcileElement: vi.fn(),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),
    setTraceHighlight: vi.fn(),
    clearTraceHighlight: vi.fn(),
    setDiffOverlay: vi.fn(),
    clearDiffOverlay: vi.fn(),
    setViewport: vi.fn(),
    allNodePositions: vi.fn(() => ({})),
    applyPositions: vi.fn(),
    mergeInPlace: vi.fn(),
    ...overrides,
  } as unknown as RendererAdapter;
}

function writeProxyReturning(result: WriteProxyResult): WriteProxyFn {
  return vi.fn().mockResolvedValue(result);
}

const LOADED_PANEL: Extract<SidePanelState, { status: "loaded" }> = {
  status: "loaded",
  label: "Onboarding",
  typeLabel: "Process",
  keyProperties: [{ path: "rdfs:comment", label: "Description", value: "Onboards a new customer" }],
  rawIri: "urn:node:1",
  nodeId: "urn:node:1",
  neighbours: [
    { iri: "urn:node:2", label: "Ship", bpmoKind: "Process", edgePredicate: "weave:next", edgeDirection: "outgoing" },
  ],
};

describe("usePanelEdit", () => {
  beforeEach(() => resetDraftHeadForTests());

  it("AC-1: saves with no drift by committing update_node via the write proxy", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({ status: 201, body: { activity_iri: "a", applied_count: 1, version_iri: "v2" } });
    const onSaved = vi.fn();

    const { result } = renderHook(() =>
      usePanelEdit({ adapter, config: DEFAULT_EXPLORER_CONFIG, panel: LOADED_PANEL, canEdit: true, writeProxy, onSaved })
    );

    act(() => result.current.openEdit());
    expect(result.current.edit.mode).toBe("edit");

    act(() => result.current.setLabel("Onboarding v2"));
    await act(async () => result.current.save());

    expect(writeProxy).toHaveBeenCalledWith(
      [{ op: "update_node", iri: "urn:node:1", properties: { label: "Onboarding v2", "rdfs:comment": "Onboards a new customer" } }],
      DEFAULT_EXPLORER_CONFIG.ceTimeoutMs
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(result.current.edit.mode).toBe("view");
  });

  it("AC-2: shows a conflict notice with current server values and does not commit when the draft head has advanced", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({ status: 201, body: {} });
    const freshServerState: FetchNodePropsResult = {
      type: "ok",
      data: {
        label: "Onboarding (edited elsewhere)",
        typeLabel: "Process",
        keyProperties: [{ path: "rdfs:comment", label: "Description", value: "Changed by someone else" }],
        rawIri: "urn:node:1",
        neighbours: [],
      },
    };
    const fetchNodeProps = vi.fn().mockResolvedValue(freshServerState);

    const { result } = renderHook(() =>
      usePanelEdit({ adapter, config: DEFAULT_EXPLORER_CONFIG, panel: LOADED_PANEL, canEdit: true, writeProxy, fetchNodeProps })
    );

    act(() => result.current.openEdit());
    act(() => result.current.setLabel("My pending edit"));

    // Someone else's write lands after edit-start but before save.
    const { bumpDraftHead } = await import("@/lib/explorer/draft-head");
    act(() => {
      bumpDraftHead();
    });

    await act(async () => result.current.save());

    expect(writeProxy).not.toHaveBeenCalled();
    expect(result.current.edit.mode).toBe("conflict");
    if (result.current.edit.mode === "conflict") {
      expect(result.current.edit.server.label).toBe("Onboarding (edited elsewhere)");
      expect(result.current.edit.yours.label).toBe("My pending edit");
    }
  });

  it("AC-3: two sequential no-drift saves both succeed, last-write-wins on canvas", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({ status: 201, body: {} });

    const { result } = renderHook(() =>
      usePanelEdit({ adapter, config: DEFAULT_EXPLORER_CONFIG, panel: LOADED_PANEL, canEdit: true, writeProxy })
    );

    act(() => result.current.openEdit());
    act(() => result.current.setLabel("First edit"));
    await act(async () => result.current.save());

    act(() => result.current.openEdit());
    act(() => result.current.setLabel("Second edit"));
    await act(async () => result.current.save());

    expect(writeProxy).toHaveBeenCalledTimes(2);
    expect(adapter.reconcileElement).toHaveBeenLastCalledWith("urn:node:1", { data: { id: "urn:node:1", label: "Second edit", bpmo_kind: "Process" } });
  });

  it("AC-4: on a 422 stays in edit mode with humanised violations, canvas untouched", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({
      status: 422,
      body: { violations: [{ focus_node: "urn:node:1", path: "rdfs:comment", severity: "Violation", message: "too long" }] },
    });

    const { result } = renderHook(() =>
      usePanelEdit({ adapter, config: DEFAULT_EXPLORER_CONFIG, panel: LOADED_PANEL, canEdit: true, writeProxy })
    );

    act(() => result.current.openEdit());
    await act(async () => result.current.save());

    expect(result.current.edit.mode).toBe("edit");
    expect(result.current.violationMessages).toEqual(["Onboarding: too long"]);
    expect(adapter.reconcileElement).not.toHaveBeenCalled();
  });

  it("AC-5/AC-6: requestDelete surfaces the full incident-edge count, confirmDelete commits and notifies onDeleted", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({ status: 201, body: {} });
    const onDeleted = vi.fn();

    const { result } = renderHook(() =>
      usePanelEdit({ adapter, config: DEFAULT_EXPLORER_CONFIG, panel: LOADED_PANEL, canEdit: true, writeProxy, onDeleted })
    );

    act(() => result.current.requestDelete());
    expect(result.current.deleteConfirm).toEqual({ incidentCount: 1 });

    await act(async () => result.current.confirmDelete());

    expect(writeProxy).toHaveBeenCalledWith(
      [
        { op: "delete_edge", subject: "urn:node:1", predicate: "weave:next", object: "urn:node:2" },
        { op: "delete_node", iri: "urn:node:1" },
      ],
      DEFAULT_EXPLORER_CONFIG.ceTimeoutMs
    );
    expect(adapter.removeElements).toHaveBeenCalledWith(["urn:node:1|weave:next|urn:node:2", "urn:node:1"]);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(result.current.deleteConfirm).toBeNull();
  });

  it("AC-7: on delete failure nothing is removed and onDeleted is not called", async () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({ status: 0, body: null });
    const onDeleted = vi.fn();

    const { result } = renderHook(() =>
      usePanelEdit({ adapter, config: DEFAULT_EXPLORER_CONFIG, panel: LOADED_PANEL, canEdit: true, writeProxy, onDeleted })
    );

    act(() => result.current.requestDelete());
    await act(async () => result.current.confirmDelete());

    expect(adapter.removeElements).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(result.current.deleteFailed).toBe(true);
  });

  it("AC-8: openEdit/requestDelete are no-ops when canEdit is false", () => {
    const adapter = fakeAdapter();
    const writeProxy = writeProxyReturning({ status: 201, body: {} });

    const { result } = renderHook(() =>
      usePanelEdit({ adapter, config: DEFAULT_EXPLORER_CONFIG, panel: LOADED_PANEL, canEdit: false, writeProxy })
    );

    act(() => result.current.openEdit());
    act(() => result.current.requestDelete());

    expect(result.current.edit.mode).toBe("view");
    expect(result.current.deleteConfirm).toBeNull();
  });
});
