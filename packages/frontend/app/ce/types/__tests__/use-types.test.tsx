import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTypes } from "../use-types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const TYPES_BODY = {
  kinds: [{ iri: "https://weave.dev/ontology/bpmo#Process", label: "Process", description: null, properties: [] }],
  relationships: [
    {
      path: "https://weave.dev/ontology/bpmo#performedBy",
      name: "performed by",
      is_relationship: true,
      min_count: 0,
      max_count: null,
      severity: "Violation",
    },
  ],
};

describe("useTypes", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes the relationships array the CE-READ-1 response already carries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(TYPES_BODY))
    );

    const { result } = renderHook(() => useTypes());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.relationships).toEqual(TYPES_BODY.relationships);
  });

  it("reload() re-fetches after a load error", async () => {
    const fetchMock = vi.fn(async () =>
      fetchMock.mock.calls.length <= 1 ? jsonResponse({ error: "down" }, 502) : jsonResponse(TYPES_BODY)
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTypes());
    await waitFor(() => expect(result.current.loadError).toBe(true));

    result.current.reload();

    await waitFor(() => expect(result.current.loadError).toBe(false));
    expect(result.current.kinds).toEqual(TYPES_BODY.kinds);
  });
});
