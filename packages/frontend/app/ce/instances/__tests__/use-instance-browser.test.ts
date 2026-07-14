import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInstanceBrowser } from "../use-instance-browser";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("useInstanceBrowser (TASK-031 AC-2)", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("test_search_and_kind_filter_intersect_and_paginate", async () => {
    let lastQuery = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/ontology/types")) {
          return jsonResponse({ kinds: [{ iri: "urn:k:Process", label: "Process", properties: [] }] });
        }
        lastQuery = decodeURIComponent(new URL(url, "http://localhost").searchParams.get("query") ?? "");
        return jsonResponse({ results: { bindings: [] } });
      })
    );

    const { result } = renderHook(() => useInstanceBrowser());

    await waitFor(() => expect(result.current.kinds).toHaveLength(1));

    act(() => result.current.setSearchTerm("invoice"));
    await waitFor(() => expect(lastQuery).toContain('CONTAINS(LCASE(?label), "invoice")'));

    act(() => result.current.toggleKindFilter("urn:k:Process"));
    await waitFor(() => expect(lastQuery).toContain("FILTER(?kind = <urn:k:Process>)"));
    // both filters intersect (AND) in the same query
    expect(lastQuery).toContain('CONTAINS(LCASE(?label), "invoice")');
    // changing a filter resets pagination back to page 1
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(2));
    await waitFor(() => expect(lastQuery).toContain("OFFSET 50"));
  });
});
