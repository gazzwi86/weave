import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectionRail } from "../section-rail";

let pathname = "/build";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const PROJECTS = [
  { project_iri: "urn:weave:project:p-1", name: "Returns flow" },
  { project_iri: "urn:weave:project:p-2", name: "Supplier portal" },
];

describe("SectionRail — Build project switcher", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ items: PROJECTS, next_cursor: null }))
    );
  });

  // refit-mock.html buildSidebarHTML(): "Projects" group (Registry link)
  // plus a "Current project" group with a live <select> switcher + the 6
  // project-scoped links, on every Build-section page.
  it("renders a Projects group and a Current project switcher with 6 project-scoped links", async () => {
    pathname = "/build";
    render(<SectionRail role="member" />);

    expect(await screen.findByRole("combobox", { name: /current project/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Returns flow" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Supplier portal" })).toBeInTheDocument();

    for (const label of [
      "Dashboard",
      "Request studio",
      "Kanban",
      "Decision log",
      "Model canvas",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Registry" })).toBeInTheDocument();
  });

  it("defaults the switcher to the project in the URL when on a project-scoped route", async () => {
    pathname = "/build/projects/urn%3Aweave%3Aproject%3Ap-2/board";
    render(<SectionRail role="member" />);

    const select = await screen.findByRole("combobox", { name: /current project/i });
    await waitFor(() => expect(select).toHaveValue("urn:weave:project:p-2"));

    expect(screen.getByRole("link", { name: "Kanban" })).toHaveAttribute(
      "href",
      "/build/projects/urn%3Aweave%3Aproject%3Ap-2/board"
    );
  });

  // Regression: the Build project switcher's fetch used to fire on every
  // route (rules-of-hooks means the hook is always called) -- confirm a
  // non-Build page renders its own static groups and never calls it.
  it("does not fetch the Build project list on a non-Build section", async () => {
    pathname = "/explorer";
    render(<SectionRail role="member" />);

    expect(await screen.findByRole("link", { name: "Explore" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /current project/i })).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
