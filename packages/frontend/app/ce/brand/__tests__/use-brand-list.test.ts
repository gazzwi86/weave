import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordAttribution } from "../attribution";
import { useBrandList } from "../use-brand-list";

// Real shape of POST /api/proxy/sparql: `{ rows: [{ variable: "value" }] }`
// (flat strings, already reshaped from Oxigraph's raw bindings server-side
// -- see route.ts's sparqlResultsToRows / fetch-domain-members.ts's own
// DomainMemberResponseBody), not a raw `{ results: { bindings } }` term shape.
function stubSparqlFetch(rows: Record<string, string>[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ rows }, { status: 200 }))
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
      { s: "urn:weave:instances:bs-1", contentType: "acme.tone", effectiveDate: "2026-01-01", owner: "Brand Team" },
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
      { s: "urn:weave:instances:bs-1", contentType: "a", effectiveDate: "2026-01-01", owner: "o" },
      { s: "urn:weave:instances:bs-2", contentType: "b", effectiveDate: "2026-01-01", owner: "o" },
    ]);

    const { result } = renderHook(() => useBrandList("standard", 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attributionFor("urn:weave:instances:bs-1")?.actorIri).toBe(
      "brand-owner@example.com"
    );
    expect(result.current.attributionFor("urn:weave:instances:bs-2")).toBeNull();
  });

  it("reports hasMore when the probe (51st) row comes back", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      s: `urn:weave:instances:bs-${i}`,
      contentType: "a",
      effectiveDate: "2026-01-01",
      owner: "o",
    }));
    stubSparqlFetch(rows);

    const { result } = renderHook(() => useBrandList("standard", 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(50);
    expect(result.current.hasMore).toBe(true);
  });

  it("lists voice rules via the same proxy when kind is voice-rule", async () => {
    stubSparqlFetch([
      { s: "urn:weave:instances:vr-1", ruleId: "no-jargon", severity: "critical", assertion: "forbidden-term:synergy" },
    ]);

    const { result } = renderHook(() => useBrandList("voice-rule", 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0]).toMatchObject({ ruleId: "no-jargon", severity: "critical" });
  });
});
