import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProjectTaskCounts } from "../use-project-task-counts";

const PROJECT_IRI = "urn:weave:project:p-1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ROLLUP = {
  project_iri: PROJECT_IRI,
  epics: [
    { epic_id: "e-1", title: "A", ordinal: 0, status: "active", task_counts: { total: 3, done: 1, in_progress: 1, blocked: 1 } },
    { epic_id: "e-2", title: "B", ordinal: 1, status: "upcoming", task_counts: { total: 2, done: 0, in_progress: 0, blocked: 2 } },
  ],
};

describe("useProjectTaskCounts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the epic rollup and sums total/done across epics", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(ROLLUP));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useProjectTaskCounts(PROJECT_IRI));

    await waitFor(() => expect(result.current).toEqual({ total: 5, done: 1 }));
    expect(fetchMock).toHaveBeenCalledWith("/api/build/projects/urn%3Aweave%3Aproject%3Ap-1/epics");
  });

  it("returns null (pending) while loading and on fetch failure", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 500));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useProjectTaskCounts(PROJECT_IRI));

    expect(result.current).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("returns zero counts for a project with no epics yet", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ project_iri: PROJECT_IRI, epics: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useProjectTaskCounts(PROJECT_IRI));

    await waitFor(() => expect(result.current).toEqual({ total: 0, done: 0 }));
  });
});
