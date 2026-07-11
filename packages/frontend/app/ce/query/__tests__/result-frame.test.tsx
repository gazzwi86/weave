import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResultFrame } from "../result-frame";
import { useExplorerCanvas } from "@/components/explorer/use-explorer-canvas";

vi.mock("@/components/explorer/use-explorer-canvas", () => ({ useExplorerCanvas: vi.fn() }));
const mockedUseExplorerCanvas = vi.mocked(useExplorerCanvas);

const RESULT = {
  sparql: "SELECT ?p WHERE { ?p a weave:Process . }",
  rows: [{ p: "urn:process-1" }],
  columnNames: ["p"],
  groundedIris: ["urn:process-1"],
};

const GRAPH_TAB_NAME = "Graph";

function stubExplorerCanvas(highlightNodes = vi.fn()) {
  mockedUseExplorerCanvas.mockReturnValue({
    loadState: "ready",
    errorMessage: null,
    minimapIndicator: null,
    containerRef: { current: null },
    retry: vi.fn(),
    adapter: { highlightNodes, resetOpacity: vi.fn() } as never,
  });
  return highlightNodes;
}

describe("ResultFrame", () => {
  it("defaults to Table view", () => {
    stubExplorerCanvas();
    render(<ResultFrame result={RESULT} />);
    expect(screen.getByRole("tab", { name: "Table", selected: true })).toBeInTheDocument();
    expect(screen.getByTestId("results-table")).toBeInTheDocument();
  });

  // CE-V1-TASK-032 AC-5 unit test: `should_toggle_result_view_without_new_fetch`.
  it("should_toggle_result_view_without_new_fetch", () => {
    stubExplorerCanvas();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ResultFrame result={RESULT} />);

    fireEvent.click(screen.getByRole("tab", { name: "Raw" }));
    expect(screen.getByTestId("result-raw")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: GRAPH_TAB_NAME }));
    expect(screen.getByTestId("grounded-graph-canvas")).toBeInTheDocument();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  // AC-6: "View SPARQL" always available, showing the exact executed query.
  it("always exposes the exact executed SPARQL via the View SPARQL disclosure", () => {
    stubExplorerCanvas();
    render(<ResultFrame result={RESULT} />);
    expect(screen.getByTestId("view-sparql-disclosure")).toHaveTextContent(RESULT.sparql);
  });

  // AC-7: grounded IRIs glow, non-matches dim; empty case dims + notes.
  it("highlights grounded IRIs on the graph view", () => {
    const highlightNodes = stubExplorerCanvas();
    render(<ResultFrame result={RESULT} />);
    fireEvent.click(screen.getByRole("tab", { name: GRAPH_TAB_NAME }));
    expect(highlightNodes).toHaveBeenCalledWith(["urn:process-1"], expect.any(Number));
  });

  it("shows a no-grounded-matches note and dims the canvas when groundedIris is empty", () => {
    const highlightNodes = stubExplorerCanvas();
    render(<ResultFrame result={{ ...RESULT, groundedIris: [] }} />);
    fireEvent.click(screen.getByRole("tab", { name: GRAPH_TAB_NAME }));
    expect(highlightNodes).toHaveBeenCalledWith([], expect.any(Number));
    expect(screen.getByTestId("grounded-graph-empty-note")).toBeInTheDocument();
  });
});
