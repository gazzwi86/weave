import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MiniMap } from "../mini-map";

describe("MiniMap", () => {
  it("mounts pinned to the bottom-right corner (AC-5)", () => {
    render(<MiniMap indicator={{ left: 5, top: 10, width: 20, height: 15 }} />);

    const minimap = screen.getByTestId("explorer-minimap");
    expect(minimap.className).toContain("right-");
    expect(minimap.className).toContain("bottom-");
  });

  it("draws the viewport indicator rectangle at the computed coordinates", () => {
    render(<MiniMap indicator={{ left: 5, top: 10, width: 20, height: 15 }} />);

    const indicator = screen.getByTestId("explorer-minimap-viewport");
    expect(indicator.style.left).toBe("5px");
    expect(indicator.style.top).toBe("10px");
  });

  it("renders no viewport indicator when the graph has not loaded yet", () => {
    render(<MiniMap indicator={null} />);

    expect(screen.queryByTestId("explorer-minimap-viewport")).not.toBeInTheDocument();
  });
});
