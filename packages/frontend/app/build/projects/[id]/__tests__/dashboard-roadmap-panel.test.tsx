import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardRoadmapPanel } from "../dashboard-roadmap-panel";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Shape lifted from packages/backend/tests/unit/test_epics_router.py +
// schemas/epics.py (EpicRollupResponse / EpicRollupEntry / EpicTaskCounts).
const ROLLUP = {
  project_iri: "p-1",
  epics: [
    {
      epic_id: "EPIC-001",
      title: "Board",
      ordinal: 0,
      status: "done",
      task_counts: { total: 3, done: 3, in_progress: 0, blocked: 0 },
    },
    {
      epic_id: "EPIC-002",
      title: "Roadmap panel",
      ordinal: 1,
      status: "active",
      task_counts: { total: 4, done: 1, in_progress: 2, blocked: 1 },
    },
    {
      epic_id: "unassigned",
      title: "Unassigned tasks",
      ordinal: 2,
      status: "upcoming",
      task_counts: { total: 1, done: 0, in_progress: 0, blocked: 0 },
    },
  ],
};

describe("DashboardRoadmapPanel (B2, docs/design/remediation-2-api-gaps.md)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders epics in ordinal order with status and task counts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(ROLLUP)))
    );
    render(<DashboardRoadmapPanel projectId="p-1" />);

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Board");
    expect(items[0]).toHaveTextContent("done");
    expect(items[0]).toHaveTextContent("3/3");
    expect(items[1]).toHaveTextContent("Roadmap panel");
    expect(items[1]).toHaveTextContent("active");
    expect(items[1]).toHaveTextContent("1/4");
    expect(items[2]).toHaveTextContent("Unassigned tasks");
    expect(items[2]).toHaveTextContent("upcoming");
  });

  it("shows human empty copy for a genuinely-empty project (no epics)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ project_iri: "p-1", epics: [] })))
    );
    render(<DashboardRoadmapPanel projectId="p-1" />);

    expect(await screen.findByText(/no epics yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("fetches the epic rollup for the given project", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(ROLLUP)));
    vi.stubGlobal("fetch", fetchMock);
    render(<DashboardRoadmapPanel projectId="p-1" />);

    await screen.findAllByRole("listitem");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/build/projects/p-1/epics")
    );
  });
});
