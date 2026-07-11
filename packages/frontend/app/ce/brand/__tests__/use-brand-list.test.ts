import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordAttribution } from "../attribution";
import { useBrandList } from "../use-brand-list";

function stubSparqlFetch(bindings: Record<string, { value: string }>[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ results: { bindings } }, { status: 200 })
    )
  );
}

describe("useBrandList", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  // AC-004-03: current values from the draft graph, 50/page.
  it("lists standards from the draft graph via the SPARQL proxy", async () => {
    stubSparqlFetch([
      {
        s: { value: "urn:weave:instances:bs-1" },
        contentType: { value: "acme.tone" },
        effectiveDate: { value: "2026-01-01" },
        owner: { value: "Brand Team" },
      },
    ]);

    const { result } = renderHook(() => useBrandList("standard", 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toMatchObject({ iri: "urn:weave:instances:bs-1", owner: "Brand Team" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/proxy/sparql",
      expect.objectContaining({ method: "POST" })
    );
  });

  // AC-004-03: each item's last-modified PROV-O attribution is shown --
  // recorded (create-time) items resolve to a real actor, others are
  // honestly "unknown" (see attribution.ts).
  it("attaches a recorded attribution to its row, and null for an unrecorded one", async () => {
    recordAttribution("urn:weave:instances:bs-1", {
      actorIri: "brand-owner@example.com",
      versionIri: "urn:weave:tenant:t:ws:w:v0.0.2",
      committedAt: "2026-07-11T00:00:00.000Z",
    });
    stubSparqlFetch([
      { s: { value: "urn:weave:instances:bs-1" }, contentType: { value: "a" }, effectiveDate: { value: "2026-01-01" }, owner: { value: "o" } },
      { s: { value: "urn:weave:instances:bs-2" }, contentType: { value: "b" }, effectiveDate: { value: "2026-01-01" }, owner: { value: "o" } },
    ]);

    const { result } = renderHook(() => useBrandList("standard", 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attributionFor("urn:weave:instances:bs-1")?.actorIri).toBe(
      "brand-owner@example.com"
    );
    expect(result.current.attributionFor("urn:weave:instances:bs-2")).toBeNull();
  });

  it("reports hasMore when the probe (51st) row comes back", async () => {
    const bindings = Array.from({ length: 51 }, (_, i) => ({
      s: { value: `urn:weave:instances:bs-${i}` },
      contentType: { value: "a" },
      effectiveDate: { value: "2026-01-01" },
      owner: { value: "o" },
    }));
    stubSparqlFetch(bindings);

    const { result } = renderHook(() => useBrandList("standard", 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(50);
    expect(result.current.hasMore).toBe(true);
  });

  it("lists voice rules via the same proxy when kind is voice-rule", async () => {
    stubSparqlFetch([
      { s: { value: "urn:weave:instances:vr-1" }, ruleId: { value: "no-jargon" }, severity: { value: "critical" }, assertion: { value: "forbidden-term:synergy" } },
    ]);

    const { result } = renderHook(() => useBrandList("voice-rule", 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0]).toMatchObject({ ruleId: "no-jargon", severity: "critical" });
  });
});
