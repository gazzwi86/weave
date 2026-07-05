import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
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
  return {
    load: vi.fn(),
    getViewport: vi.fn(() => ({ zoom: 1, pan: { x: 0, y: 0 } })),
    setLayout: vi.fn(),
    spotlightNode: vi.fn(() => true),
    resetOpacity: vi.fn(),
    highlightNodes: vi.fn(),
    onNodeTap: vi.fn(() => vi.fn()),
    onBackgroundTap: vi.fn(() => vi.fn()),
    getNodeData: vi.fn(() => ({ label: "Customer Onboarding", bpmoKind: "Process" })),
    listNodes: vi.fn(() => []),
    centerOn: vi.fn(),
    onNodeDragEnd: vi.fn(() => vi.fn()),
    ...overrides,
  };
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
