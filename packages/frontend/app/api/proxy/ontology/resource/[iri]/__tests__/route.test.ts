import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const IRI = "https://weave.example/entity/cust-onboarding";
const TENANT_B_IRI = "https://weave.example/entity/tenant-b-secret";

function header(claims: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(claims)).toString("base64url");
}

/** Builds an unsigned-but-well-formed JWT carrying the given claims -- the
 * route only decodes the payload (getCognitoRoleClaim), it never re-verifies
 * the signature (see get-cognito-role-claim.ts's own doc comment). */
function fakeJwt(claims: Record<string, unknown>): string {
  return `${header({ alg: "RS256" })}.${header(claims)}.signature`;
}

function makeRequest(iri: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/proxy/ontology/resource/${encodeURIComponent(iri)}`);
}

function paramsFor(iri: string): { params: Promise<{ iri: string }> } {
  return { params: Promise.resolve({ iri }) };
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function mockAuthedSession(accessToken: string | null): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const LABEL_PREDICATE = "https://weave.example/ontology/weave#label";
const COMMENT_PREDICATE = "http://www.w3.org/2000/01/rdf-schema#comment";

// CE-READ-1's real `GET /api/ontology/resource/{iri}` shape (schemas/ontology.py's
// ResourceResponse) -- iri/kind/label/version_iri/triples/outgoing/incoming,
// NOT the pre-shaped panel body the route used to (wrongly) assume.
const CE_RESPONSE_BODY = {
  iri: IRI,
  kind: "Process",
  label: "Customer Onboarding@en",
  version_iri: "https://weave.example/versions/v1",
  triples: [
    { subject: IRI, predicate: RDF_TYPE, object: "https://weave.example/ontology/bpmo#Process" },
    { subject: IRI, predicate: LABEL_PREDICATE, object: "Customer Onboarding@en" },
    { subject: IRI, predicate: COMMENT_PREDICATE, object: "Onboards a new customer@en" },
  ],
  outgoing: [],
  incoming: [],
};

describe("GET /api/proxy/ontology/resource/[iri] -- auth and validation", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    mockAuthedSession(null);

    const response = await GET(makeRequest(IRI), paramsFor(IRI));

    expect(response.status).toBe(401);
  });

  it("returns 400 for a non-absolute IRI (Law 13)", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(makeRequest("not-an-iri"), paramsFor("not-an-iri"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/proxy/ontology/resource/[iri] -- forwarding and role-gated raw IRI", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(CE_RESPONSE_BODY), { status: 200, headers: { "content-type": "application/json" } })
    );
  });

  it("forwards the IRI and bearer token to CE-READ-1", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));

    await GET(makeRequest(IRI), paramsFor(IRI));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/ontology/resource/${encodeURIComponent(IRI)}`),
      expect.objectContaining({ headers: { Authorization: expect.stringContaining("Bearer ") } })
    );
  });

  it("strips @lang tags from label/type_label/property values before returning", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));

    const response = await GET(makeRequest(IRI), paramsFor(IRI));
    const body = await response.json();

    expect(body.label).toBe("Customer Onboarding");
    expect(body.type_label).toBe("Process");
    expect(body.key_properties[0].value).toBe("Onboards a new customer");
  });

  // Bug fix regression: CE-READ-1's resource.py appends every self triple to
  // `triples` unconditionally, including rdf:type and the label triple --
  // without excluding them, key_properties would carry them, and
  // use-panel-edit.ts's save path would rewrite the node's type/label as a
  // plain string literal on the next edit.
  it("maps kind/triples/outgoing/incoming to type_label/bpmo_kind/key_properties, excluding rdf:type, the label triple, and edge-duplicate triples", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));
    const RELATED_IRI = "https://weave.example/entity/invoice-1";
    const RELATES_TO = "https://weave.example/ontology/bpmo#relatesTo";
    stubFetch(
      new Response(
        JSON.stringify({
          iri: IRI,
          kind: "Process",
          label: "Customer Onboarding",
          version_iri: "https://weave.example/versions/v1",
          triples: [
            { subject: IRI, predicate: RDF_TYPE, object: "https://weave.example/ontology/bpmo#Process" },
            { subject: IRI, predicate: LABEL_PREDICATE, object: "Customer Onboarding" },
            { subject: IRI, predicate: RELATES_TO, object: RELATED_IRI },
            { subject: IRI, predicate: COMMENT_PREDICATE, object: "Onboards a new customer" },
          ],
          outgoing: [{ predicate: RELATES_TO, target: RELATED_IRI }],
          incoming: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const response = await GET(makeRequest(IRI), paramsFor(IRI));
    const body = await response.json();

    expect(body.type_label).toBe("Process");
    expect(body.bpmo_kind).toBe("Process");
    expect(body.key_properties).toEqual([{ path: COMMENT_PREDICATE, label: "comment", value: "Onboards a new customer" }]);
  });
});

describe("GET /api/proxy/ontology/resource/[iri] -- role-gated raw IRI and neighbours", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(CE_RESPONSE_BODY), { status: 200, headers: { "content-type": "application/json" } })
    );
  });

  it("omits raw_iri (null) for a viewer/no-role JWT (AC-2)", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));

    const response = await GET(makeRequest(IRI), paramsFor(IRI));
    const body = await response.json();

    expect(body.raw_iri).toBeNull();
  });

  it("includes raw_iri only for a JWT carrying the ontologist role claim (AC-2)", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1", role: "ontologist" }));

    const response = await GET(makeRequest(IRI), paramsFor(IRI));
    const body = await response.json();

    expect(body.raw_iri).toBe(IRI);
  });

  // TASK-005 AC-3: [] when upstream's outgoing/incoming are both empty --
  // callers (fetch-node-props.ts) always get an array, never undefined.
  it("returns [] neighbours when the upstream outgoing/incoming edges are both empty", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));

    const response = await GET(makeRequest(IRI), paramsFor(IRI));
    const body = await response.json();

    expect(body.neighbours).toEqual([]);
  });

  // TASK-005 AC-3: outgoing/incoming edges map to neighbours with direction,
  // @lang stripped from the fallback (local-name) label -- this is the same
  // fetch fetch-node-props.ts already issues for the side panel, reused for
  // expansion (no second CE-READ-1 round trip, see renderer-adapter.ts's
  // expandNode). CE-READ-1's edges carry no neighbour label/kind (a genuine
  // data gap -- see route.ts's toNeighbours comment), so the mapper falls
  // back to the target/source IRI's local name and an empty kind.
  it("maps outgoing/incoming edges to neighbours with direction (AC-3)", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));
    stubFetch(
      new Response(
        JSON.stringify({
          ...CE_RESPONSE_BODY,
          outgoing: [
            {
              predicate: "https://weave.example/ontology/bpmo#relatesTo",
              target: "https://weave.example/entity/invoice-1",
            },
          ],
          incoming: [
            {
              predicate: "https://weave.example/ontology/bpmo#ownedBy",
              source: "https://weave.example/entity/finance-team",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const response = await GET(makeRequest(IRI), paramsFor(IRI));
    const body = await response.json();

    expect(body.neighbours).toEqual([
      {
        iri: "https://weave.example/entity/invoice-1",
        label: "invoice-1",
        bpmo_kind: "",
        edge_predicate: "https://weave.example/ontology/bpmo#relatesTo",
        edge_direction: "outgoing",
      },
      {
        iri: "https://weave.example/entity/finance-team",
        label: "finance-team",
        bpmo_kind: "",
        edge_predicate: "https://weave.example/ontology/bpmo#ownedBy",
        edge_direction: "incoming",
      },
    ]);
  });
});

describe("GET /api/proxy/ontology/resource/[iri] -- errors and cross-tenant isolation", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    mockAuthedSession(fakeJwt({ sub: "u1" }));
  });

  // AC-8: cross-tenant isolation -- CE-READ-1 returns 404 for an IRI
  // belonging to another tenant. The route must never surface any part of
  // the 404 response body.
  it("returns 404 'not_found' and never surfaces the upstream 404 body (AC-8)", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "not_found", label: "TENANT-B-SECRET-LABEL" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(makeRequest(TENANT_B_IRI), paramsFor(TENANT_B_IRI));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "not_found" });
    expect(JSON.stringify(body)).not.toContain("TENANT-B-SECRET-LABEL");
  });

  it("returns 503 when CE-READ-1 is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET(makeRequest(IRI), paramsFor(IRI));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });

  it("returns 503 when CE-READ-1 itself reports store_unavailable", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "store_unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(makeRequest(IRI), paramsFor(IRI));

    expect(response.status).toBe(503);
  });

  // Known-issue regression: a 2xx + json-content-type upstream response that
  // then fails to parse used to escape as an uncaught exception -- Next.js
  // renders that as a raw 500 with an empty body (the intermittent
  // 500/503-empty-body symptom Lane A saw during BUG-02 verification). It
  // must instead collapse to the same structured 503 as any other outage.
  it("returns structured 503 (not an uncaught 500) when the upstream 2xx body is malformed JSON", async () => {
    stubFetch(new Response("{not valid json", { status: 200, headers: { "content-type": "application/json" } }));

    const response = await GET(makeRequest(IRI), paramsFor(IRI));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });

  it("returns structured 503 (not an uncaught 500) when the upstream 2xx body has an unexpected shape", async () => {
    stubFetch(
      new Response(JSON.stringify({ iri: IRI, label: "X@en" /* missing kind/triples/outgoing/incoming */ }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(makeRequest(IRI), paramsFor(IRI));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });
});
