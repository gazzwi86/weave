import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarChart } from "../BarChart";

describe("BarChart", () => {
  it("renders one grouped bar segment per category, per series", () => {
    render(
      <BarChart
        categories={["workspace", "security"]}
        series={[
          { label: "2026-06", values: [9, 3] },
          { label: "2026-07", values: [12, 3] },
        ]}
      />
    );

    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getAllByTestId("bar-chart-segment")).toHaveLength(4);
  });

  it("renders each category label as a link when hrefFor is given (AC-3 drill-in)", () => {
    render(
      <BarChart
        categories={["workspace"]}
        series={[{ label: "2026-07", values: [12] }]}
        hrefFor={(category) => `/audit/logs?event_type=${category}`}
      />
    );

    expect(screen.getByRole("link", { name: "workspace" })).toHaveAttribute(
      "href",
      "/audit/logs?event_type=workspace"
    );
  });

  it("renders an EmptyState when there is no series data (no prior period on record)", () => {
    render(<BarChart categories={[]} series={[]} />);

    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});
