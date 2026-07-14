import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuditLog, type AuditFilters } from "../use-audit-log";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const EMPTY_PAGE = { entries: [], total: 0, page: 1, per_page: 50 };

describe("useAuditLog filters (AC-5)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-5: test_logs_filter_bar_exposes_all_seven_query_dimensions
  it("test_logs_filter_bar_exposes_all_seven_query_dimensions", async () => {
    const fetchMock = vi.fn(async (_url: string) => jsonResponse(EMPTY_PAGE));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuditLog());

    await waitFor(() => expect(result.current.filters).not.toBeNull());
    fetchMock.mockClear();

    const filters: AuditFilters = {
      engine: "ce",
      event_type: "ce.version.published",
      actor_principal_iri: "urn:weave:principal:user:abc123",
      target_iri: "urn:weave:entity:1",
      date_from: "2026-07-01",
      date_to: "2026-07-31",
      q: "renamed",
    };

    act(() => result.current.applyFilters(filters));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calledUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
    const query = new URL(calledUrl, "http://localhost").searchParams;
    expect(query.get("engine")).toBe("ce");
    expect(query.get("event_type")).toBe("ce.version.published");
    expect(query.get("actor_principal_iri")).toBe("urn:weave:principal:user:abc123");
    expect(query.get("target_iri")).toBe("urn:weave:entity:1");
    expect(query.get("date_from")).toBe("2026-07-01");
    expect(query.get("date_to")).toBe("2026-07-31");
    expect(query.get("q")).toBe("renamed");
  });

  it("resets to page 1 when filters change", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(EMPTY_PAGE)));

    const { result } = renderHook(() => useAuditLog());
    await waitFor(() => expect(result.current.filters).not.toBeNull());

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.applyFilters({ ...(result.current.filters as AuditFilters), engine: "ce" }));
    expect(result.current.page).toBe(1);
  });
});
