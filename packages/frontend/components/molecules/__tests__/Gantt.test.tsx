import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Gantt, type GanttRow } from "../Gantt";

const SCALE = ["Jun 23", "Jun 30", "Jul 7", "Jul 14", "Jul 21", "Jul 28"];

const ROWS: GanttRow[] = [
  { id: "e1", label: "Epic 1 · Intake & RMA", status: "done", statusLabel: "done", startPct: 0, widthPct: 38 },
  { id: "e2", label: "Epic 2 · Approval flow", status: "active", statusLabel: "in progress", startPct: 30, widthPct: 42 },
  { id: "e3", label: "Epic 3 · Restock pipeline", status: "future", statusLabel: "up next", startPct: 64, widthPct: 34 },
];

describe("Gantt", () => {
  it("renders a scale label per column and a row per entry", () => {
    render(<Gantt scaleLabels={SCALE} rows={ROWS} todayPct={62} />);
    for (const label of SCALE) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Epic 1 · Intake & RMA")).toBeInTheDocument();
    expect(screen.getByText("Epic 3 · Restock pipeline")).toBeInTheDocument();
  });

  it("positions each bar at its start/width percentage", () => {
    render(<Gantt scaleLabels={SCALE} rows={ROWS} todayPct={62} />);
    const bar = screen.getByTestId("gantt-bar-e2");
    expect(bar).toHaveStyle({ left: "30%", width: "42%" });
  });

  it("labels each bar with its status text, not colour alone", () => {
    render(<Gantt scaleLabels={SCALE} rows={ROWS} todayPct={62} />);
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByText("up next")).toBeInTheDocument();
  });

  it("positions the today line at the given percentage in every row", () => {
    render(<Gantt scaleLabels={SCALE} rows={ROWS} todayPct={62} />);
    const todayLines = screen.getAllByTestId("gantt-today-line");
    expect(todayLines).toHaveLength(ROWS.length);
    for (const line of todayLines) {
      expect(line).toHaveStyle({ left: "62%" });
    }
  });
});
