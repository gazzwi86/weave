import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKindCounts } from "../use-kind-counts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function auditEntry(kindCounts: Record<string, number> | undefined) {
  return {
    seq: 1,
    ts: "2026-07-15T00:00:00Z",
    actor_principal_iri: "urn:weave:principal:tenant-1:human:alice",
    engine: "constitution",
    event_type: "operations.applied",
    target_iri: "urn:weave:version:abc",
    diff_summary: kindCounts ? { kind_counts: kindCounts } : null,
    hash: "h1",
    prev_hash: "h0",
    signature: "sig",
  };
}

describe("useKindCounts (G5)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches operations.applied entries for the current month and sums kind_counts across them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          entries: [
            auditEntry({ Process: 3, edges: 1 }),
            auditEntry({ Process: 1, Policy: 2 }),
          ],
          total: 2,
          page: 1,
          per_page: 200,
        })
      )
    );

    const { result } = renderHook(() => useKindCounts());

    await waitFor(() => expect(result.current.counts).not.toBeNull());
    expect(result.current.counts).toEqual({ Process: 4, edges: 1, Policy: 2 });
    expect(result.current.denied).toBe(false);
    expect(result.current.loadError).toBe(false);

    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain("/api/audit?");
    expect(new URL(calledUrl, "http://localhost").searchParams.get("event_type")).toBe("operations.applied");
  });

  it("treats a null diff_summary as contributing no kinds, not an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ entries: [auditEntry(undefined)], total: 1, page: 1, per_page: 200 }))
    );

    const { result } = renderHook(() => useKindCounts());

    await waitFor(() => expect(result.current.counts).not.toBeNull());
    expect(result.current.counts).toEqual({});
  });

  it("sets denied on a 403 without setting loadError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "forbidden" }, 403)));

    const { result } = renderHook(() => useKindCounts());

    await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.loadError).toBe(false);
  });
});
