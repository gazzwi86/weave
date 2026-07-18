import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePolicies } from "../use-policies";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePolicies", () => {
  it("loads and maps policy rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, { rows: [{ s: "urn:weave:instances:policy-1", label: "Vendor risk policy" }] })
      )
    );

    const { result } = renderHook(() => usePolicies(0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([{ iri: "urn:weave:instances:policy-1", label: "Vendor risk policy" }]);
    expect(result.current.error).toBe(false);
  });

  it("surfaces an error on a failed proxy call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error: "store_unavailable" })));

    const { result } = renderHook(() => usePolicies(0));

    await waitFor(() => expect(result.current.error).toBe(true));
  });
});
