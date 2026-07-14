import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDashboard } from "../project-dashboard";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const DEMO = { output_location_ref: "s3://weave-artefacts/t1/run-1/", last_run_status: "passed" };
const BUDGET = { label: "estimated", total_estimate_usd: 12.5, cap_usd: 100, level: "company" };
const FORECAST = {
  label: "estimated",
  forecast_usd: 40,
  forecast_inputs: {
    basis: "calibrated",
    mean_actual: 2,
    completed_count: 3,
    remaining_count: 4,
    calibration: 1.1,
  },
};
const TASKS = { ready: 2, blocked: 1, done: 3, revision: 0 };
const BLOCKERS = { items: [{ task_id: "task-9", reason: "HITL pending" }] };
const RIBBON = {
  runs: [
    {
      run_id: "run-1",
      branch: "main",
      commit_sha: "abc123",
      created_at: "2026-07-01T00:00:00Z",
      repo_url: "https://github.com/acme/widgets",
    },
  ],
};

/** AC-1: each tile fetches its own `/dashboard/{tile}` endpoint. */
function stubAllTilesOk(): void {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/dashboard/demo")) return Promise.resolve(jsonResponse(DEMO));
    if (url.endsWith("/dashboard/budget")) return Promise.resolve(jsonResponse(BUDGET));
    if (url.endsWith("/dashboard/forecast")) return Promise.resolve(jsonResponse(FORECAST));
    if (url.endsWith("/dashboard/tasks")) return Promise.resolve(jsonResponse(TASKS));
    if (url.endsWith("/dashboard/blockers")) return Promise.resolve(jsonResponse(BLOCKERS));
    if (url.endsWith("/dashboard/ribbon")) return Promise.resolve(jsonResponse(RIBBON));
    return Promise.reject(new Error(`unexpected fetch ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
}

describe("ProjectDashboard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders all six tiles from their own per-tile endpoints (AC-1)", async () => {
    stubAllTilesOk();
    render(<ProjectDashboard projectId="p-1" />);

    await waitFor(() => expect(screen.getAllByText(/estimated/i).length).toBeGreaterThan(0));
    expect(screen.getByText("Demo readiness")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getByText("Forecast")).toBeInTheDocument();
    expect(screen.getByText("Tasks in flight")).toBeInTheDocument();
    expect(screen.getByText("Blockers")).toBeInTheDocument();
    expect(screen.getByText("Git ribbon")).toBeInTheDocument();
  });

  it("keeps every other tile alive when one tile's source errors (AC-2, core isolation)", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/dashboard/budget")) return Promise.resolve(jsonResponse({ error: "down" }, 503));
      if (url.endsWith("/dashboard/demo")) return Promise.resolve(jsonResponse(DEMO));
      if (url.endsWith("/dashboard/forecast")) return Promise.resolve(jsonResponse(FORECAST));
      if (url.endsWith("/dashboard/tasks")) return Promise.resolve(jsonResponse(TASKS));
      if (url.endsWith("/dashboard/blockers")) return Promise.resolve(jsonResponse(BLOCKERS));
      if (url.endsWith("/dashboard/ribbon")) return Promise.resolve(jsonResponse(RIBBON));
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectDashboard projectId="p-1" />);

    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());
    // The failing tile shows a localized error + retry, everything else renders.
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByText("Tasks in flight")).toBeInTheDocument();
    expect(screen.getByText("Blockers")).toBeInTheDocument();
    expect(screen.getByText("Git ribbon")).toBeInTheDocument();
    expect(await screen.findByText(/40/)).toBeInTheDocument();
  });

  it("renders budget/forecast tiles with the estimated label, cascade level, and forecast inputs (AC-4)", async () => {
    stubAllTilesOk();
    render(<ProjectDashboard projectId="p-1" />);

    await waitFor(() => expect(screen.getAllByText(/estimated/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/capped at company/i)).toBeInTheDocument();
    expect(screen.getByText(/3 done \/ 4 remaining/i)).toBeInTheDocument();
  });

  it("renders the git ribbon from recorded runs with branch, sha, and repo link (AC-5)", async () => {
    stubAllTilesOk();
    render(<ProjectDashboard projectId="p-1" />);

    const link = await screen.findByRole("link", { name: /abc123/i });
    expect(link).toHaveAttribute("href", "https://github.com/acme/widgets");
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("shows the read-only self-improvement card only when the feed has items (AC-6)", async () => {
    stubAllTilesOk();
    const { rerender } = render(<ProjectDashboard projectId="p-1" selfImprovementItems={[]} />);
    await waitFor(() => expect(screen.getByText("Demo readiness")).toBeInTheDocument());
    expect(screen.queryByTestId("self-improvement-card")).not.toBeInTheDocument();

    rerender(
      <ProjectDashboard
        projectId="p-1"
        selfImprovementItems={[{ id: "si-1", title: "Tighten retry budget", href: "https://platform.example/si-1" }]}
      />
    );
    expect(await screen.findByTestId("self-improvement-card")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tighten retry budget/i })).toHaveAttribute(
      "href",
      "https://platform.example/si-1"
    );
  });
});
