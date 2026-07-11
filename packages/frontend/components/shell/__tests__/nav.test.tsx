import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Nav } from "../nav";
import { SectionRail } from "../section-rail";

// PoC IA (docs/design/poc-ia-proposal.md): pathname under a section prefix
// marks that section's tab active — /ce/query/history belongs to Constitution.
let pathname = "/ce/query/history";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("Nav", () => {
  it("renders the six IA areas with the active one aria-current", () => {
    pathname = "/ce/query/history";
    render(<Nav />);

    const areas = ["Home", "Constitution", "Build", "Events", "Audit trail", "Settings"];
    for (const label of areas) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    const active = screen.getByRole("link", { name: "Constitution" });
    expect(active).toHaveAttribute("aria-current", "page");

    const inactive = screen.getByRole("link", { name: "Build" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("marks Audit trail active on the legacy /compliance route", () => {
    pathname = "/compliance";
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Audit trail" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

describe("SectionRail", () => {
  it("renders grouped items with status pills; placeholders are dimmed non-links", () => {
    pathname = "/ce/query";
    render(<SectionRail role="admin" />);

    expect(screen.getByRole("navigation", { name: "Secondary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Instances \/ Data/ })).toHaveAttribute(
      "href",
      "/ce"
    );
    // M2 placeholder: no link, phase pill present.
    expect(screen.queryByRole("link", { name: /Glossary/ })).not.toBeInTheDocument();
    expect(screen.getByText("Glossary")).toBeInTheDocument();
    const pills = screen.getAllByText("M2");
    expect(pills.length).toBeGreaterThan(0);
  });

  it("hides admin-only items from non-admin roles (IA §5 RBAC split)", () => {
    pathname = "/settings/models";
    const { rerender } = render(<SectionRail role="author" />);
    expect(screen.queryByText("Workspaces")).not.toBeInTheDocument();

    rerender(<SectionRail role="admin" />);
    expect(screen.getByRole("link", { name: /Workspaces/ })).toBeInTheDocument();
  });

  it("renders the Home rail's Notifications entry (AC-4 nav reachability)", () => {
    pathname = "/dashboard";
    render(<SectionRail role="admin" />);
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
  });

  // AC-1: collapse toggle persists across page loads via localStorage.
  it("collapses on toggle click and restores the collapsed state on remount (reload proxy)", () => {
    pathname = "/ce/query";
    localStorage.clear();
    const { unmount } = render(<SectionRail role="admin" />);

    expect(screen.getByRole("navigation", { name: "Secondary" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /collapse sidebar/i });
    fireEvent.click(toggle);

    expect(localStorage.getItem("weave.sectionRail.collapsed")).toBe("true");
    expect(screen.queryByRole("navigation", { name: "Secondary" })).not.toBeInTheDocument();

    unmount();
    render(<SectionRail role="admin" />);
    expect(screen.queryByRole("navigation", { name: "Secondary" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeInTheDocument();
  });
});
