import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const PRINCIPAL_IRI = "urn:weave:principal:user:cognito-sub-1";

function fakeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.signature`;
}

const TOKEN_WITH_PRINCIPAL = fakeJwt({ sub: "cognito-sub-1", principal_iri: PRINCIPAL_IRI });
const TOKEN_WITHOUT_PRINCIPAL = fakeJwt({ sub: "cognito-sub-1" });

const ADD_NODE_OP = { op: "add_node", ref: "local:1", kind: "Process", label: "New process" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/proxy/operations/apply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function stubFetch(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockAuthedSession(accessToken: string | null): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

describe("POST /api/proxy/operations/apply -- AC-1/AC-2 security guards", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 and makes no CE call when there is no session", async () => {
    mockAuthedSession(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ operations: [ADD_NODE_OP] }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body carries a client-supplied actor field (spoof guard)", async () => {
    mockAuthedSession(TOKEN_WITH_PRINCIPAL);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ operations: [ADD_NODE_OP], actor: "urn:weave:principal:user:spoofed" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 and makes no CE call when the JWT carries no principal_iri claim", async () => {
    mockAuthedSession(TOKEN_WITHOUT_PRINCIPAL);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ operations: [ADD_NODE_OP] }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 and makes no CE call when principal_iri claim is present but empty (falsy, not missing)", async () => {
    // Edge case: a naive `principal !== null` check would let an empty-string
    // claim through and forward `actor: ""` to CE-WRITE-1 -- unattributed
    // write. getPrincipalIriClaim + route.ts's `!principal` check must treat
    // "" the same as a missing claim (ADR-019: no edit without attribution).
    mockAuthedSession(fakeJwt({ sub: "cognito-sub-1", principal_iri: "" }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ operations: [ADD_NODE_OP] }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an operations array that fails the CE-WRITE-1 op schema", async () => {
    mockAuthedSession(TOKEN_WITH_PRINCIPAL);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ operations: [{ op: "add_node" }] }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/proxy/operations/apply -- forwarding and passthrough", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    mockAuthedSession(TOKEN_WITH_PRINCIPAL);
  });

  it("sets actor verbatim from the principal_iri claim, never from sub, and pins target to draft", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ activity_iri: "urn:activity:1", applied_count: 1, version_iri: "urn:v:draft" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );

    await POST(makeRequest({ operations: [ADD_NODE_OP] }));

    const [calledUrl, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/operations/apply");
    expect(options.headers).toMatchObject({ Authorization: `Bearer ${TOKEN_WITH_PRINCIPAL}` });
    const sentBody = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(sentBody.actor).toBe(PRINCIPAL_IRI);
    expect(sentBody.target).toBe("draft");
    expect(sentBody.operations).toEqual([{ ...ADD_NODE_OP, properties: {}, additional_types: [] }]);
  });

  it("passes through a 201 success response", async () => {
    const body = { activity_iri: "urn:activity:1", applied_count: 1, version_iri: "urn:v:draft" };
    stubFetch(new Response(JSON.stringify(body), { status: 201, headers: { "content-type": "application/json" } }));

    const response = await POST(makeRequest({ operations: [ADD_NODE_OP] }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(body);
  });

  it("passes through a 422 SHACL violation response unchanged", async () => {
    const body = { violations: [{ focus_node: "urn:x", path: "bpmo:performedBy", severity: "Violation", message: "required" }] };
    stubFetch(new Response(JSON.stringify(body), { status: 422, headers: { "content-type": "application/json" } }));

    const response = await POST(makeRequest({ operations: [ADD_NODE_OP] }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(body);
  });

  it("returns 503 when CE is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await POST(makeRequest({ operations: [ADD_NODE_OP] }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });
});
