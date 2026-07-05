import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExplorerCanvas } from "../explorer-canvas";
import { useExplorerCanvas } from "../use-explorer-canvas";

vi.mock("../use-explorer-canvas", () => ({ useExplorerCanvas: vi.fn() }));

const mockedUseExplorerCanvas = vi.mocked(useExplorerCanvas);

describe("ExplorerCanvas", () => {
  it("renders the canvas container and mini-map once ready (AC-1/AC-5)", () => {
    mockedUseExplorerCanvas.mockReturnValue({
      loadState: "ready",
      errorMessage: null,
      minimapIndicator: { left: 1, top: 2, width: 3, height: 4 },
      containerRef: { current: null },
      retry: vi.fn(),
    });

    render(<ExplorerCanvas />);

    expect(screen.getByTestId("explorer-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("explorer-minimap")).toBeInTheDocument();
  });

  it("renders the empty-state with retry wired to the hook on CE error, no canvas mounted (AC-2)", () => {
    const retry = vi.fn();
    mockedUseExplorerCanvas.mockReturnValue({
      loadState: "error",
      errorMessage: "CE error 503",
      minimapIndicator: null,
      containerRef: { current: null },
      retry,
    });

    render(<ExplorerCanvas />);

    expect(screen.queryByTestId("explorer-canvas")).not.toBeInTheDocument();
    expect(screen.getByTestId("explorer-empty-state")).toHaveTextContent("CE error 503");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
