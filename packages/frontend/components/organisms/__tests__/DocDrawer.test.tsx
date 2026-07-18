import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocDrawer } from "../DocDrawer";

describe("DocDrawer", () => {
  it("renders the title and children body when open", () => {
    render(
      <DocDrawer open title="Brief" onClose={vi.fn()} meta={["Updated 2026-07-17", "v3"]}>
        <p>Body copy.</p>
      </DocDrawer>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Brief")).toBeInTheDocument();
    expect(screen.getByText("Body copy.")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <DocDrawer open={false} title="Brief" onClose={vi.fn()} meta={[]}>
        <p>Body copy.</p>
      </DocDrawer>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders one meta span per meta item, dot-separated", () => {
    render(
      <DocDrawer open title="Brief" onClose={vi.fn()} meta={["Updated 2026-07-17", "v3", "Approved"]}>
        <p>Body copy.</p>
      </DocDrawer>
    );
    expect(screen.getByText("Updated 2026-07-17")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("uses the wide doc drawer size", () => {
    render(
      <DocDrawer open title="Brief" onClose={vi.fn()} meta={[]}>
        <p>Body copy.</p>
      </DocDrawer>
    );
    expect(screen.getByRole("dialog").className).toMatch(/size-drawer-doc/);
  });

  it("renders arbitrary rich children, e.g. a heading with an inline StatusPill", () => {
    render(
      <DocDrawer open title="Epics" onClose={vi.fn()} meta={[]}>
        <h5>
          EPIC-011 <span>published</span>
        </h5>
      </DocDrawer>
    );
    expect(screen.getByText("EPIC-011", { exact: false })).toBeInTheDocument();
  });
});
