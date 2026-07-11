import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDecisionLog } from "../use-decision-log";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PAGE_1 = {
  entries: [
    {
      seq: 3,
      ts: "2026-07-11T00:00:03+00:00",
      actor_principal_iri: "urn:weave:principal:user:alice",
      event_type: "gate_result_dor",
      target_iri: "urn:weave:project:t1:acme",
      diff_summary: null,
      kind: "decision",
    },
  ],
  next_cursor: null,
};

describe("useDecisionLog", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/build/projects/p-1/decisions");
  });

  // AC-1
  it("fetches the first page with the default kind filter", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(PAGE_1));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDecisionLog("p-1"));

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("kind=decision"));
  });

  // AC-2
  it("surfaces audit unavailable on a 503 without fabricating rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "audit_unavailable" }, 503))
    );

    const { result } = renderHook(() => useDecisionLog("p-1"));

    await waitFor(() => expect(result.current.auditUnavailable).toBe(true));
    expect(result.current.entries).toHaveLength(0);
  });

  // AC-8
  it("re-queries the server (not client-side row hiding) when the kind filter changes", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(PAGE_1));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDecisionLog("p-1"));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    result.current.setKind("all");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("kind=all"))
    );
  });

  // AC-6
  it("paginates via cursor and appends rather than replaces on loadMore", async () => {
    const page1 = { entries: [{ ...PAGE_1.entries[0], seq: 2 }], next_cursor: 2 };
    const page2 = { entries: [{ ...PAGE_1.entries[0], seq: 1 }], next_cursor: null };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDecisionLog("p-1"));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.hasMore).toBe(true);

    result.current.loadMore();

    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.entries.map((e) => e.seq)).toEqual([2, 1]);
    expect(result.current.hasMore).toBe(false);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("cursor=2"));
  });

  // AC-3
  it("seeds the search filter from a ?record deep link and marks it for highlight once loaded", async () => {
    window.history.replaceState({}, "", "/build/projects/p-1/decisions?record=3");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(PAGE_1)));

    const { result } = renderHook(() => useDecisionLog("p-1"));

    await waitFor(() => expect(result.current.highlightSeq).toBe(3));
  });
});
