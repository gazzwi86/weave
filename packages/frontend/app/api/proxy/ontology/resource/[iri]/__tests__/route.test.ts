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

const CE_RESPONSE_BODY = {
  iri: IRI,
  label: "Customer Onboarding@en",
  type_label: "Process@en",
  bpmo_kind: "Process",
  key_properties: [{ path: "rdfs:comment", label: "Description", value: "Onboards a new customer@en" }],
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

  // TASK-005 AC-3: defaults to [] when upstream omits neighbours -- callers
  // (fetch-node-props.ts) always get an array, never undefined.
  it("defaults neighbours to [] when the upstream response omits it", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));

    const response = await GET(makeRequest(IRI), paramsFor(IRI));
    const body = await response.json();

    expect(body.neighbours).toEqual([]);
  });

  // TASK-005 AC-3: neighbours pass through with the same @lang stripping
  // applied to every other label -- this is the same fetch fetch-node-props.ts
  // already issues for the side panel, reused for expansion (no second
  // CE-READ-1 round trip, see renderer-adapter.ts's expandNode).
  it("passes through neighbours with @lang stripped from each label (AC-3)", async () => {
    mockAuthedSession(fakeJwt({ sub: "u1" }));
    stubFetch(
      new Response(
        JSON.stringify({
          ...CE_RESPONSE_BODY,
          neighbours: [
            {
              iri: "https://weave.example/entity/invoice-1",
              label: "Invoice 1@en",
              bpmo_kind: "DataAsset",
              edge_predicate: "https://weave.example/ontology/bpmo#relatesTo",
              edge_direction: "outgoing",
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
        label: "Invoice 1",
        bpmo_kind: "DataAsset",
        edge_predicate: "https://weave.example/ontology/bpmo#relatesTo",
        edge_direction: "outgoing",
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
});
