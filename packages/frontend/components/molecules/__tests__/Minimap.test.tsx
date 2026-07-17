import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Minimap, type MinimapNode } from "../Minimap";

const NODES: MinimapNode[] = [
  { id: "n1", x: 20, y: 10, colorVar: "--color-kind-process" },
  { id: "n2", x: 100, y: 60, colorVar: "--color-kind-actor" },
];

const VIEWPORT_RECT = { left: 10, top: 5, width: 40, height: 30 };

describe("Minimap", () => {
  it("renders one dot per node at its coordinates", () => {
    const { container } = render(<Minimap nodes={NODES} viewportRect={VIEWPORT_RECT} />);
    const dots = container.querySelectorAll("circle");
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute("cx", "20");
    expect(dots[0]).toHaveAttribute("cy", "10");
  });

  it("renders the viewport indicator rect from the given props, not recomputed", () => {
    const { container } = render(<Minimap nodes={NODES} viewportRect={VIEWPORT_RECT} />);
    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("x", "10");
    expect(rect).toHaveAttribute("y", "5");
    expect(rect).toHaveAttribute("width", "40");
    expect(rect).toHaveAttribute("height", "30");
  });

  it("renders no dots when there are no nodes yet", () => {
    const { container } = render(<Minimap nodes={[]} viewportRect={VIEWPORT_RECT} />);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
  });
});
