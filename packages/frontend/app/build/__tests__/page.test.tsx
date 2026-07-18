import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../registry-grid", () => ({
  RegistryGrid: () => <div data-testid="registry-grid-stub" />,
}));

import BuildRegistryPage from "../page";

// refit-mock.html #sub-bld-registry: PageHeader-driven title/subtitle
// ("Projects" / "Everything Weave is building or running for you --
// grounded in the Constitution.") with "New project" as a header action,
// not inline in the grid's filter row.
describe("BuildRegistryPage", () => {
  it("renders the mock's title and subtitle via PageHeader", () => {
    render(<BuildRegistryPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
    expect(
      screen.getByText("Everything Weave is building or running for you — grounded in the Constitution.")
    ).toBeInTheDocument();
  });

  it("renders New project as a header action", () => {
    render(<BuildRegistryPage />);
    expect(screen.getByRole("button", { name: "New project" })).toBeInTheDocument();
  });
});
