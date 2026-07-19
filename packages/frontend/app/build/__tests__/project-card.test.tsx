import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectCard } from "../project-card";
import type { ProjectCard as ProjectCardData } from "../use-project-grid";

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
  it("renders the name and links the whole card to the project dashboard", () => {
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
    render(<ProjectCard project={{ ...BASE, lifecycle_phase: phase }} />);
    expect(screen.getByText(pillText)).toBeInTheDocument();
  });

  // ProjectCardResponse (schemas/projects.py) carries no task-count/budget
  // fields -- a residual not covered by G9-G12 (those are epic/gate gaps,
  // not registry-card gaps). Render the honest pending state, never fake
  // numbers, following the audit dashboard's established convention.
  it("shows an honest pending state for task counts and budget (no backing field)", () => {
    render(<ProjectCard project={BASE} />);
    expect(screen.getByTestId("project-card-meta-pending")).toHaveTextContent(
      /available yet/i
    );
  });

  it("falls back to Unassigned when owner_iri is absent", () => {
    render(<ProjectCard project={{ ...BASE, owner_iri: null }} />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });
});
