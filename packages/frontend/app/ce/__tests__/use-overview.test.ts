import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOverview } from "../use-overview";
import type { VersionEntry } from "../versions/types";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const KINDS = { kinds: [{ id: "Process", label: "Process", colour: "#22d3ee" }] };

const SPARQL_PAGE = {
  rows: [{ subject: "urn:a", predicate: RDF_TYPE, object: "https://weave.io/ontology/Process" }],
  columns: ["subject", "predicate", "object"],
  has_more_pages: false,
  page: 0,
};

const VERSION: VersionEntry = {
  version_iri: "urn:workspace:demo:v1",
  semver: "0.1.6",
  status: "published",
  created_at: "2026-07-01T10:00:00Z",
  published_at: "2026-07-01T10:05:00Z",
  actor_iri: "urn:weave:user:client",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(versionsBody: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("node-kinds")) return jsonResponse(KINDS);
      if (url.includes("sparql")) return jsonResponse(SPARQL_PAGE);
      if (url.includes("versions")) return jsonResponse(versionsBody);
      throw new Error(`unexpected fetch: ${url}`);
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useOverview -- published version source", () => {
  // Bug: /api/proxy/ontology/versions returns a bare VersionEntry[], but
  // fetchPublishedVersions only handled the { versions } envelope --
  // publishedSemver silently stayed null forever.
  it("reads publishedSemver + recentVersions from a bare array response", async () => {
    stubFetch([VERSION]);

    const { result } = renderHook(() => useOverview());

    await waitFor(() => expect(result.current.stats).not.toBeNull());
    expect(result.current.stats?.publishedSemver).toBe("0.1.6");
    expect(result.current.stats?.recentVersions).toEqual([VERSION]);
  });

  it("still reads publishedSemver from a wrapped { versions } envelope", async () => {
    stubFetch({ versions: [VERSION] });

    const { result } = renderHook(() => useOverview());

    await waitFor(() => expect(result.current.stats).not.toBeNull());
    expect(result.current.stats?.publishedSemver).toBe("0.1.6");
  });
});
