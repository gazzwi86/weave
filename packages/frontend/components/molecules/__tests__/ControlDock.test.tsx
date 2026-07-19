import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ControlDock, type ControlDockTab } from "../ControlDock";

const TABS: ControlDockTab[] = [
  { id: "filters", label: "Filters", icon: <span aria-hidden="true">F</span>, panel: <div>Filters panel</div> },
  { id: "layers", label: "Layers", icon: <span aria-hidden="true">L</span>, panel: <div>Layers panel</div> },
];

describe("ControlDock", () => {
  it("renders a tab per entry and no open panel when activeTab is null", () => {
    render(<ControlDock tabs={TABS} activeTab={null} onTabChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Layers" })).toBeInTheDocument();
    expect(screen.queryByText("Filters panel")).not.toBeInTheDocument();
  });

  it("shows only the active tab's panel", () => {
    render(<ControlDock tabs={TABS} activeTab="layers" onTabChange={vi.fn()} />);
    expect(screen.getByText("Layers panel")).toBeInTheDocument();
    expect(screen.queryByText("Filters panel")).not.toBeInTheDocument();
  });

  it("asks to open a tab that isn't active", async () => {
    const onTabChange = vi.fn();
    render(<ControlDock tabs={TABS} activeTab={null} onTabChange={onTabChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(onTabChange).toHaveBeenCalledWith("filters");
  });

  it("asks to close the tab that is already active (single-open accordion)", async () => {
    const onTabChange = vi.fn();
    render(<ControlDock tabs={TABS} activeTab="filters" onTabChange={onTabChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(onTabChange).toHaveBeenCalledWith(null);
  });

  // G19: the outer wrapper has no background of its own -- the gap between
  // the tab bar and the open panel is transparent canvas, but the wrapper
  // <div> still sits over it and (with default pointer-events: auto) swallows
  // clicks meant for a cytoscape node underneath. The wrapper opts out
  // (pointer-events-none) and each real, backgrounded row opts back in
  // (pointer-events-auto) so only the visibly-opaque chrome blocks clicks.
  it("lets clicks in the gap between tab bar and panel pass through to the canvas (G19)", () => {
    const { container } = render(<ControlDock tabs={TABS} activeTab="layers" onTabChange={vi.fn()} />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("pointer-events-none");

    const tabBar = screen.getByRole("button", { name: "Layers" }).parentElement as HTMLElement;
    expect(tabBar).toHaveClass("pointer-events-auto");

    const panel = screen.getByTestId("control-dock-panel-layers");
    expect(panel).toHaveClass("pointer-events-auto");
  });
});
