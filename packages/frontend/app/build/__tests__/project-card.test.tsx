import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectCard } from "../project-card";
import type { ProjectCard as ProjectCardData } from "../use-project-grid";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Stubs the card's epic-rollup fetch (`useProjectTaskCounts`) for one test. */
function stubEpicsFetch(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse(body, status))
  );
}

const BASE: ProjectCardData = {
  project_iri: "urn:weave:project:p-1",
  name: "Returns flow",
  created_at: "2026-07-01T00:00:00Z",
  lifecycle_phase: "Building",
  owner_iri: "urn:weave:principal:user:admin",
};

// refit-mock.html #sub-bld-registry: name + lifecycle phase pill + owner.
// Whole card is a single link to the project dashboard (BE-V1-TASK-019).
describe("ProjectCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the name and links the whole card to the project dashboard", () => {
    stubEpicsFetch({ epics: [] });
    render(<ProjectCard project={BASE} />);
    expect(screen.getByText("Returns flow")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Returns flow/ })).toHaveAttribute(
      "href",
      `/build/projects/${encodeURIComponent(BASE.project_iri)}`
    );
  });

  // Mock's phase-pill vocabulary ("building"/"live"/"archived") is its own
  // wording, not the API's lifecycle_phase strings -- StatusPill's `label`
  // override carries it while `status` still drives the tone.
  it.each([
    ["Speccing", "speccing"],
    ["Building", "building"],
    ["Live monitoring", "live"],
    ["Archived", "archived"],
  ] as const)("renders the %s phase as the %s pill", (phase, pillText) => {
    stubEpicsFetch({ epics: [] });
    render(<ProjectCard project={{ ...BASE, lifecycle_phase: phase }} />);
    expect(screen.getByText(pillText)).toBeInTheDocument();
  });

  // B1 (docs/design/remediation-2-api-gaps.md): task counts come from the
  // epic rollup (G9/G10), fetched lazily per card and summed client-side.
  // No per-project budget source exists anywhere in the backend (checked:
  // the billing budget gate is tenant/workspace-scoped, not per-project),
  // so budget stays an honest "--" rather than a fabricated number.
  it("shows the pending state while the task-count fetch is in flight, then the counts", async () => {
    stubEpicsFetch({
      epics: [{ task_counts: { total: 3, done: 1 } }, { task_counts: { total: 2, done: 2 } }],
    });
    render(<ProjectCard project={BASE} />);
    expect(screen.getByTestId("project-card-meta-pending")).toHaveTextContent(/available yet/i);

    await waitFor(() =>
      expect(screen.getByTestId("project-card-task-counts")).toHaveTextContent("3/5 tasks done")
    );
    expect(screen.getByTestId("project-card-budget")).toHaveTextContent("—");
  });

  it("keeps the honest pending state when the task-count fetch fails", async () => {
    stubEpicsFetch({}, 500);
    render(<ProjectCard project={BASE} />);

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(screen.getByTestId("project-card-meta-pending")).toHaveTextContent(/available yet/i);
  });

  it("falls back to Unassigned when owner_iri is absent", () => {
    stubEpicsFetch({ epics: [] });
    render(<ProjectCard project={{ ...BASE, owner_iri: null }} />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });
});
