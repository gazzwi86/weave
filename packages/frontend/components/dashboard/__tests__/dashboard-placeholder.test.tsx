import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardPlaceholder } from "../dashboard-placeholder";

describe("DashboardPlaceholder", () => {
  it("renders the M1 empty state and grid layout (AC-5)", () => {
    render(<DashboardPlaceholder />);

    expect(
      screen.getByText("Your dashboard activates with the Constitution Engine")
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-placeholder-grid")).toHaveClass("grid");
  });

  it("shows the M2 availability footer label (AC-6)", () => {
    render(<DashboardPlaceholder />);

    expect(screen.getByText("Constitution Engine — available at M2")).toBeInTheDocument();
  });

  it("renders no prompt bar or AI surface", () => {
    render(<DashboardPlaceholder />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
