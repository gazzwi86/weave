import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SecondarySidebar } from "../SecondarySidebar";

describe("SecondarySidebar", () => {
  // Build rail's "Current project" group needs a live <select> switcher
  // above its links (refit-mock.html buildSidebarHTML) -- a generic
  // render-prop slot on the group, not Build-specific knowledge baked
  // into this shared organism.
  it("renders a group's selector slot above its items", () => {
    render(
      <SecondarySidebar
        groups={[
          {
            heading: "Current project",
            selector: <select aria-label="Current project">
              <option>Returns flow</option>
            </select>,
            items: [{ label: "Dashboard", href: "/build/projects/p-1" }],
          },
        ]}
      />
    );

    expect(screen.getByLabelText("Current project")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("omits the selector slot entirely when a group has none", () => {
    render(
      <SecondarySidebar
        groups={[{ heading: "Projects", items: [{ label: "Registry", href: "/build" }] }]}
      />
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("hints the collapse button's shortcut on hover (refit-mock.html .panel-toggle)", () => {
    render(
      <SecondarySidebar
        groups={[{ heading: "Projects", items: [{ label: "Registry", href: "/build" }] }]}
        title="Build"
        onCollapse={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
      "title",
      "Hide sidebar (⌘\\)"
    );
  });
});
