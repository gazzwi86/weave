import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Nav } from "../nav";

// CE-TASK-007 shipped the real Constitution Engine route at "/ce/query"
// (nav-items.ts), replacing the placeholder "/ce" -- match a real subroute.
vi.mock("next/navigation", () => ({
  usePathname: () => "/ce/query/history",
}));

describe("Nav", () => {
  it("renders all seven area links with the active one aria-current", () => {
    render(<Nav />);

    const areas = [
      "Platform",
      "Constitution Engine",
      "Build Engine",
      "Events & Actions",
      "Graph Explorer",
      "Onboarding",
      "Settings",
    ];
    for (const label of areas) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    const active = screen.getByRole("link", { name: "Constitution Engine" });
    expect(active).toHaveAttribute("aria-current", "page");

    const inactive = screen.getByRole("link", { name: "Build Engine" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });
});
