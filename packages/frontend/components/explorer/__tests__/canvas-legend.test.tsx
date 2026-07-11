import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
