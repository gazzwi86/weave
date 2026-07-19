import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDashboard } from "../project-dashboard";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const BUDGET = { label: "estimated", total_estimate_usd: 46, cap_usd: 100, level: "company" };
const BLOCKERS = { items: [{ task_id: "task-9", reason: "needs a decision on partial refunds" }] };
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
const BOARD = {
  project_iri: "p-1",
  lanes: ["Backlog", "Ready", "In Progress", "Review", "QA", "Done"],
  cards: [
    { id: "task-1", status: "Done", lane: "Done", failure_class: null, retry_attempt: null, retry_ceiling: null, hitl_escalated: false },
    { id: "task-2", status: "Done", lane: "Done", failure_class: null, retry_attempt: null, retry_ceiling: null, hitl_escalated: false },
    { id: "task-8", status: "In review", lane: "Review", failure_class: null, retry_attempt: null, retry_ceiling: null, hitl_escalated: true },
    { id: "task-9", status: "Blocked", lane: "In Progress", failure_class: null, retry_attempt: null, retry_ceiling: null, hitl_escalated: false },
  ],
};
const TREE = { project_iri: "p-1", nodes: [] };

function stubApis({ board = BOARD }: { board?: typeof BOARD } = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/dashboard/budget")) return Promise.resolve(jsonResponse(BUDGET));
    if (url.endsWith("/dashboard/blockers")) return Promise.resolve(jsonResponse(BLOCKERS));
    if (url.endsWith("/dashboard/ribbon")) return Promise.resolve(jsonResponse(RIBBON));
    if (url.endsWith("/board")) return Promise.resolve(jsonResponse(board));
    if (url.endsWith("/task-tree")) return Promise.resolve(jsonResponse(TREE));
    if (url.includes("/tasks/task-8")) {
      return Promise.resolve(
        jsonResponse({ brief: { acceptance_criteria: [] }, handoff: [], console: {}, captures_manifest_ref: null })
      );
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ProjectDashboard (refit-mock #sub-bld-dashboard)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the page header and sub-copy", async () => {
    stubApis();
    render(<ProjectDashboard projectId="p-1" />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/where the build is/i)).toBeInTheDocument();
  });

  it("shows a gate band derived from a Review/QA lane card, and opens the review drawer (G12)", async () => {
    stubApis();
    const user = userEvent.setup();
    render(<ProjectDashboard projectId="p-1" />);

    expect(await screen.findByText(/review gate waiting on you/i)).toBeInTheDocument();
    expect(screen.getByText(/task-8/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /review now/i }));
    expect(await screen.findByText(/Review gate — task-8/i)).toBeInTheDocument();
  });

  it("shows no gate band when nothing is in Review/QA", async () => {
    const board = { ...BOARD, cards: BOARD.cards.filter((c) => c.lane !== "Review") };
    stubApis({ board });
    render(<ProjectDashboard projectId="p-1" />);

    await screen.findByText("Dashboard");
    expect(screen.queryByText(/review gate waiting on you/i)).not.toBeInTheDocument();
  });

  it("renders the KPI row: real tasks/budget counts, pending epics (G9)", async () => {
    stubApis();
    render(<ProjectDashboard projectId="p-1" />);

    expect(await screen.findByText("4")).toBeInTheDocument(); // tasks created
    expect(screen.getByText("2")).toBeInTheDocument(); // tasks done
    expect(screen.getByText("1")).toBeInTheDocument(); // blocked
    expect(screen.getByText("$46")).toBeInTheDocument();
    expect(screen.getByText(/of \$100 budget used/)).toBeInTheDocument();
    expect(screen.getByText("epics created")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows the roadmap panel as pending-state with the G10 gap note", async () => {
    stubApis();
    render(<ProjectDashboard projectId="p-1" />);
    expect(await screen.findByText(/no epic timeline data yet/i)).toBeInTheDocument();
  });

  it("opens a real task-briefs DocDrawer listing board tasks (G11)", async () => {
    stubApis();
    const user = userEvent.setup();
    render(<ProjectDashboard projectId="p-1" />);

    await user.click(await screen.findByText("Task briefs"));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("task-1")).toBeInTheDocument();
    expect(within(dialog).getByText("task-9")).toBeInTheDocument();
  });

  it("opens a static placeholder DocDrawer for Brief/PRD/Roadmap/Tech spec (G11)", async () => {
    stubApis();
    const user = userEvent.setup();
    render(<ProjectDashboard projectId="p-1" />);

    await user.click(await screen.findByText("Brief"));
    expect(await screen.findByText(/isn't available yet/i)).toBeInTheDocument();
  });

  it("renders activity merged from blockers and recent runs", async () => {
    stubApis();
    render(<ProjectDashboard projectId="p-1" />);

    expect(await screen.findByText(/needs a decision on partial refunds/)).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });
});
