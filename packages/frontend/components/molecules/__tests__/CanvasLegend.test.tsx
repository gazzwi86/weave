import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CanvasLegend } from "../CanvasLegend";

const ENTRIES = [
  { kind: "process" as const, label: "Process" },
  { kind: "actor" as const, label: "Actor" },
];

describe("CanvasLegend", () => {
  it("renders a labelled swatch per kind entry", () => {
    render(<CanvasLegend entries={ENTRIES} />);
    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("Actor")).toBeInTheDocument();
  });

  it("renders the tools row's status text and zoom-controls slot when given", () => {
    render(
      <CanvasLegend
        entries={ENTRIES}
        statusLabel="12 kinds · published v14"
        zoomControls={<button aria-label="Zoom in">+</button>}
      />
    );
    expect(screen.getByText("12 kinds · published v14")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  });

  it("omits the tools row when no statusLabel is given", () => {
    render(<CanvasLegend entries={ENTRIES} />);
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
  });
});
