import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

import { PageHeader } from "../PageHeader";

// AC-2: title renders at --text-h1 (F-D07: the built app rendered 28px/600
// instead) and a breadcrumb trail renders when supplied. Button hierarchy
// (single primary + secondary/ghost, never two brights) is exercised by
// composing real Button variants into `actions` -- the same way every real
// page will use this slot.
const TITLE = "Instances / Data";

describe("PageHeader", () => {
  it("renders the title at --text-h1, never a bespoke smaller size", () => {
    render(<PageHeader title={TITLE} />);
    const heading = screen.getByRole("heading", { level: 1, name: TITLE });
    expect(heading.className).toContain("text-[length:var(--text-h1)]");
  });

  it("renders a breadcrumb trail above the title when supplied", () => {
    render(
      <PageHeader
        title={TITLE}
        breadcrumb={[{ label: "Workspace", href: "/dashboard" }, { label: "Constitution", href: "/ce" }, { label: TITLE }]}
      />
    );
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveTextContent("Workspace");
    expect(nav).toHaveTextContent("Constitution");
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("href", "/dashboard");
    // The current page's own crumb is not a link.
    expect(screen.queryByRole("link", { name: TITLE })).not.toBeInTheDocument();
  });

  it("renders no breadcrumb nav when the prop is omitted", () => {
    render(<PageHeader title={TITLE} />);
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });

  it("supports a single primary action alongside secondary/ghost actions with no second bright button", () => {
    render(
      <PageHeader
        title={TITLE}
        actions={
          <>
            <Button variant="ghost">Export</Button>
            <Button variant="secondary">Filter</Button>
            <Button variant="primary">New instance</Button>
          </>
        }
      />
    );
    const buttons = screen.getAllByRole("button");
    const primaryCount = buttons.filter((b) => b.textContent === "New instance").length;
    expect(primaryCount).toBe(1);
    expect(buttons).toHaveLength(3);
  });
});
