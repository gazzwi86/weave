import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePendingGatesCount } from "../use-pending-gates-count";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("usePendingGatesCount (H4: dashboard 'Needs you' gates row)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => usePendingGatesCount());
    expect(result.current.loading).toBe(true);
    expect(result.current.count).toBeNull();
  });

  it("sums pending gates across the workspace's projects (fans out to each project's G12 endpoint)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/build/projects") && !url.includes("/gates")) {
        return jsonResponse({
          items: [
            { project_iri: "p-1", name: "Project 1" },
            { project_iri: "p-2", name: "Project 2" },
          ],
        });
      }
      if (url.includes("/projects/p-1/gates")) {
        return jsonResponse({ project_iri: "p-1", gates: [{ task_id: "t-1" }, { task_id: "t-2" }] });
      }
      if (url.includes("/projects/p-2/gates")) {
        return jsonResponse({ project_iri: "p-2", gates: [{ task_id: "t-3" }] });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePendingGatesCount());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(3);
  });

  it("fails soft to a zero count when the project list fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, 500)));

    const { result } = renderHook(() => usePendingGatesCount());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(0);
  });

  it("fails soft, excluding just the failing project, when one project's gates fetch fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/build/projects") && !url.includes("/gates")) {
        return jsonResponse({
          items: [
            { project_iri: "p-1", name: "Project 1" },
            { project_iri: "p-2", name: "Project 2" },
          ],
        });
      }
      if (url.includes("/projects/p-1/gates")) {
        return jsonResponse({ project_iri: "p-1", gates: [{ task_id: "t-1" }] });
      }
      if (url.includes("/projects/p-2/gates")) {
        return jsonResponse({ error: "not_found" }, 404);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePendingGatesCount());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(1);
  });

  it("returns zero with no fan-out when the workspace has no projects", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePendingGatesCount());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
