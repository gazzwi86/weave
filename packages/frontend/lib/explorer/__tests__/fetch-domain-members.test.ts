import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDomainMembers } from "../fetch-domain-members";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const DOMAIN_IRI = "https://weave.example/domain/finance";
const PREDICATE = "https://weave.example/ontology/bpmo#memberOfDomain";

describe("fetchDomainMembers", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-1 integration test: "should call CE-READ-1 SPARQL SELECT with domain
  // IRI and return member list".
  it("POSTs a domain-member SPARQL query to the proxy and returns the row list", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        rows: [{ entity_iri: "https://weave.example/entity/invoice-1", entity_label: "Invoice 1" }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDomainMembers(DOMAIN_IRI, PREDICATE, 10_000);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/proxy/sparql",
      expect.objectContaining({ method: "POST" })
    );
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sentBody = JSON.parse(options.body as string) as { query: string };
    expect(sentBody.query).toContain(`<${PREDICATE}>`);
    expect(sentBody.query).toContain(`<${DOMAIN_IRI}>`);

    expect(result).toEqual({
      type: "ok",
      rows: [{ entityIri: "https://weave.example/entity/invoice-1", entityLabel: "Invoice 1" }],
    });
  });

  it("returns an empty row list when the domain has no members (AC-2)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ rows: [] })));

    const result = await fetchDomainMembers(DOMAIN_IRI, PREDICATE, 10_000);

    expect(result).toEqual({ type: "ok", rows: [] });
  });

  it("returns an error result on a non-ok response (AC-1 error path)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "store_unavailable" }, 503)));

    const result = await fetchDomainMembers(DOMAIN_IRI, PREDICATE, 10_000);

    expect(result).toEqual({ type: "error", status: 503 });
  });

  it("returns a network-error result (status 0) instead of throwing when fetch rejects/aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      })
    );

    const result = await fetchDomainMembers(DOMAIN_IRI, PREDICATE, 10_000);

    expect(result).toEqual({ type: "error", status: 0 });
  });

  it("returns a 422 error without ever calling fetch for an unsafe domain IRI", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDomainMembers("not-an-iri", PREDICATE, 10_000);

    expect(result).toEqual({ type: "error", status: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
