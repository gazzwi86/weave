import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExplorerPage from "../page";

vi.mock("@/components/explorer/explorer-canvas-loader", () => ({
  ExplorerCanvasLoader: () => <div data-testid="explorer-canvas-loader-stub" />,
}));

describe("ExplorerPage", () => {
  it("renders the page heading and mounts the client-only canvas loader", () => {
    render(<ExplorerPage />);

    expect(screen.getByRole("heading", { name: "Graph Explorer" })).toBeInTheDocument();
    expect(screen.getByTestId("explorer-canvas-loader-stub")).toBeInTheDocument();
  });
});
