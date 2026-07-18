import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useKindTypeahead } from "../use-kind-typeahead";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useKindTypeahead", () => {
  it("maps typeahead results into kind-aware EntityPickerOptions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          results: [{ iri: "urn:weave:instances:process-1", label: "Onboard vendor", kind: "process" }],
        })
      )
    );

    const { result } = renderHook(({ query }) => useKindTypeahead(query), { initialProps: { query: "onboard" } });

    await waitFor(() =>
      expect(result.current).toEqual([
        { id: "urn:weave:instances:process-1", label: "Onboard vendor", kind: "process", kindLabel: "Process" },
      ])
    );
  });

  it("falls back to concept for an unrecognized or empty kind", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          results: [{ iri: "urn:weave:instances:x-1", label: "Mystery item", kind: "" }],
        })
      )
    );

    const { result } = renderHook(({ query }) => useKindTypeahead(query), { initialProps: { query: "mystery" } });

    await waitFor(() =>
      expect(result.current).toEqual([
        { id: "urn:weave:instances:x-1", label: "Mystery item", kind: "concept", kindLabel: "Concept" },
      ])
    );
  });

  it("returns no options below the 2-char query floor", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(({ query }) => useKindTypeahead(query), { initialProps: { query: "a" } });
    expect(result.current).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
