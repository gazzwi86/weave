import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKindShape } from "../use-kind-shape";

const PROCESS = {
  iri: "urn:weave:kind:Process",
  label: "Process",
  properties: [
    {
      path: "urn:weave:prop:owner",
      name: "Owner",
      is_relationship: false,
      min_count: 1,
      max_count: 1,
      severity: "Violation",
    },
  ],
};

function stubKinds(kinds: unknown[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ kinds, relationships: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
  );
}

describe("useKindShape", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-006-07: fields come from the live CE-READ-1 shape, not a hard-coded list.
  it("fetches and returns the matching kind shape", async () => {
    stubKinds([PROCESS]);
    const { result } = renderHook(() => useKindShape("urn:weave:kind:Process"));
    await waitFor(() => expect(result.current.shape).not.toBeNull());
    expect(result.current.shape?.properties).toHaveLength(1);
  });

  it("returns a null shape when no kind is selected", () => {
    const { result } = renderHook(() => useKindShape(null));
    expect(result.current.shape).toBeNull();
  });

  // AC-006-11: no stale cached forms -- a fresh fetch happens on every open.
  it("re-fetches fresh on every open, picking up ontology changes", async () => {
    stubKinds([PROCESS]);
    const first = renderHook(() => useKindShape("urn:weave:kind:Process"));
    await waitFor(() => expect(first.result.current.shape?.properties).toHaveLength(1));

    const updated = {
      ...PROCESS,
      properties: [
        ...PROCESS.properties,
        {
          path: "urn:weave:prop:sponsor",
          name: "Sponsor",
          is_relationship: true,
          min_count: null,
          max_count: 1,
          severity: "Warning",
        },
      ],
    };
    stubKinds([updated]);
    const second = renderHook(() => useKindShape("urn:weave:kind:Process"));
    await waitFor(() => expect(second.result.current.shape?.properties).toHaveLength(2));
  });
});
