import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OverlayLegendModel } from "@/lib/explorer/overlay-engine";
import type { NodeKind } from "@/lib/explorer/types";

import { CanvasLegend } from "../canvas-legend";

const PALETTE: NodeKind[] = [
  { id: "process", label: "Process", colour: "var(--color-kind-process)" },
  { id: "policy", label: "Policy", colour: "var(--color-kind-policy)" },
];

describe("CanvasLegend", () => {
  it("shows a loading message while the palette is loading (D-6)", () => {
    render(<CanvasLegend palette={[]} loading={true} />);

    expect(screen.getByTestId("explorer-legend")).toHaveTextContent("Loading");
  });

  it("renders one colour-and-label row per kind once loaded (D-2)", () => {
    render(<CanvasLegend palette={PALETTE} loading={false} />);

    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("Policy")).toBeInTheDocument();
  });

  it("keeps a re-open toggle visible when collapsed -- never fully hidden (D-4)", () => {
    render(<CanvasLegend palette={PALETTE} loading={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse legend" }));

    expect(screen.queryByText("Process")).not.toBeInTheDocument();
    const reopen = screen.getByRole("button", { name: "Expand legend" });
    expect(reopen).toBeInTheDocument();

    fireEvent.click(reopen);
    expect(screen.getByText("Process")).toBeInTheDocument();
  });

  // D-1: overlay legend mounts into this same shared shell -- never a
  // second floating legend panel.
  it("renders no overlay section when no overlay is active", () => {
    render(<CanvasLegend palette={PALETTE} loading={false} overlay={null} />);

    expect(screen.getAllByTestId("explorer-legend")).toHaveLength(1);
    expect(screen.queryByText("Heatmap — maturity")).not.toBeInTheDocument();
  });

  it("renders the active overlay's title and colour+label entries inside the same shell (D-1/D-2)", () => {
    const overlay: OverlayLegendModel = {
      title: "Heatmap — maturity",
      entries: [{ label: "High", colour: "var(--color-heat-5)" }],
    };
    render(<CanvasLegend palette={PALETTE} loading={false} overlay={overlay} />);

    expect(screen.getAllByTestId("explorer-legend")).toHaveLength(1);
    expect(screen.getByText("Heatmap — maturity")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    // still the base kind palette too -- overlay is an addition, not a swap.
    expect(screen.getByText("Process")).toBeInTheDocument();
  });

  it("renders the overlay note on its own line, never folded into an entry label (AC-1/AC-6)", () => {
    const overlay: OverlayLegendModel = {
      title: "Heatmap — maturity",
      entries: [],
      note: "0/3 nodes matched -- no data for this dimension",
    };
    render(<CanvasLegend palette={PALETTE} loading={false} overlay={overlay} />);

    expect(screen.getByText("0/3 nodes matched -- no data for this dimension")).toBeInTheDocument();
  });
});
