import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HelpLauncher } from "../help-launcher";
import { Nav } from "../nav";
import { SectionRail } from "../section-rail";

// PoC IA (docs/design/poc-ia-proposal.md): pathname under a section prefix
// marks that section's tab active — /ce/query/history belongs to Constitution.
let pathname = "/ce/query/history";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("Nav", () => {
  // Events is the one IA area not yet built (nav-items.ts's disabled: true)
  // -- it renders dimmed and non-navigable, never a link (task item 2).
  const LINK_AREAS = ["Home", "Constitution", "Build", "Audit trail", "Settings"];

  it("renders the built IA areas as links, with the active one aria-current", () => {
    pathname = "/ce/query/history";
    render(<Nav />);

    for (const label of LINK_AREAS) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    const active = screen.getByRole("link", { name: "Constitution" });
    expect(active).toHaveAttribute("aria-current", "page");

    const inactive = screen.getByRole("link", { name: "Build" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  // v5 icon rail: every area is an icon-only link, so its accessible name
  // must come from aria-label (axe: icon buttons need a discernible name).
  it("gives every icon-rail link area an aria-label accessible name", () => {
    pathname = "/dashboard";
    render(<Nav />);
    for (const label of LINK_AREAS) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-label", label);
    }
  });

  // feedback_no_phase_pills.md: unbuilt IA areas render disabled with a
  // plain "coming soon" tooltip, never a working link.
  it("renders Events disabled with a coming-soon tooltip, not a link", () => {
    pathname = "/dashboard";
    render(<Nav />);
    expect(screen.queryByRole("link", { name: /Events/ })).not.toBeInTheDocument();
    const disabledItem = screen.getByLabelText(/Events.*coming soon/i);
    expect(disabledItem).toHaveAttribute("aria-disabled", "true");
  });

  it("marks Audit trail active on /audit/compliance (AC-6 canonical route)", () => {
    pathname = "/audit/compliance";
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Audit trail" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  // S4 (docs/design/remediation-2-api-gaps.md): the rail footer used to be a
  // decorative, aria-hidden user-initial badge with no click handler --
  // "two help affordances, one dead". It's now a real "Help" trigger that
  // opens the SAME panel as the header's "?" (shared window event), proven
  // here by rendering both together rather than spying on the dispatch.
  describe("footer help trigger", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockImplementation(() => Promise.resolve(Response.json({})));
    });

    it("opens the shared Help panel when clicked", () => {
      pathname = "/dashboard";
      render(
        <>
          <Nav />
          <HelpLauncher />
        </>
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Both Nav's footer trigger and HelpLauncher's own header trigger are
      // accessibly named "Help" (same panel, two entry points) -- scope to
      // the rail so this test exercises the footer button specifically.
      const rail = screen.getByRole("navigation", { name: "Primary" });
      fireEvent.click(within(rail).getByRole("button", { name: "Help" }));

      expect(screen.getByRole("dialog", { name: /help/i })).toBeInTheDocument();
    });
  });
});

describe("SectionRail", () => {
  it("renders grouped items with status pills; placeholders are dimmed non-links", () => {
    pathname = "/ce/query";
    render(<SectionRail role="admin" />);

    expect(screen.getByRole("navigation", { name: "Secondary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Instances \/ Data/ })).toHaveAttribute(
      "href",
      "/ce/instances"
    );
    // Glossary shipped in TASK-002 -- now a real link, not a placeholder.
    expect(screen.getByRole("link", { name: /Glossary/ })).toHaveAttribute(
      "href",
      "/ce/glossary"
    );
    // feedback_no_phase_pills.md: unbuilt items get one plain "soon" pill,
    // never M1/M2/v1.0/post-v1 jargon.
    const pills = screen.getAllByText("soon");
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

  // AC-1: collapse toggle persists across page loads via localStorage. The
  // expand affordance now lives in the top bar (see app-shell.test.tsx) --
  // a collapsed SectionRail simply renders no Secondary nav.
  it("collapses on toggle click and stays collapsed on remount (reload proxy)", () => {
    pathname = "/ce/query";
    localStorage.clear();
    const { unmount } = render(<SectionRail role="admin" />);

    expect(screen.getByRole("navigation", { name: "Secondary" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    expect(localStorage.getItem("weave.sectionRail.collapsed")).toBe("true");
    expect(screen.queryByRole("navigation", { name: "Secondary" })).not.toBeInTheDocument();

    unmount();
    render(<SectionRail role="admin" />);
    expect(screen.queryByRole("navigation", { name: "Secondary" })).not.toBeInTheDocument();
  });

  // Edge case (QA): a corrupted/foreign localStorage value must not be
  // read as "collapsed" -- only the exact string "true" should. Guards
  // against a future storage-key collision or a manual devtools edit
  // silently collapsing the sidebar for every user.
  it("treats any localStorage value other than the exact string 'true' as expanded", () => {
    pathname = "/ce/query";
    localStorage.setItem("weave.sectionRail.collapsed", "1");
    render(<SectionRail role="admin" />);
    expect(screen.getByRole("navigation", { name: "Secondary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
  });
});
