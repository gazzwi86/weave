import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "token-abc";
const IRI = "urn:workspace:demo:v2";

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/proxy/ontology/versions/${encodeURIComponent(IRI)}/publish`, {
    method: "POST",
  });
}

function paramsFor(iri: string): { params: Promise<{ iri: string }> } {
  return { params: Promise.resolve({ iri }) };
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function mockAuthedSession(accessToken: string | null = TOKEN): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

describe("POST /api/proxy/ontology/versions/[iri]/publish -- auth and validation", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    mockAuthedSession(null);

    const response = await POST(makeRequest(), paramsFor(IRI));

    expect(response.status).toBe(401);
  });

  it("returns 400 for an empty version_iri (Law 13)", async () => {
    mockAuthedSession();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest(), paramsFor(""));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/proxy/ontology/versions/[iri]/publish -- forwarding and status passthrough", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    mockAuthedSession();
  });

  it("encodes the version_iri into the upstream path and forwards the bearer token", async () => {
    stubFetch(
      new Response(JSON.stringify({ version_iri: IRI, status: "published", published_at: "2026-07-06T10:10:00Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await POST(makeRequest(), paramsFor(IRI));

    const [calledUrl, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain(`/api/ontology/versions/${encodeURIComponent(IRI)}/publish`);
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });

  it("passes through a 200 publish result", async () => {
    const body = { version_iri: IRI, status: "published", published_at: "2026-07-06T10:10:00Z" };
    stubFetch(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));

    const response = await POST(makeRequest(), paramsFor(IRI));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
  });

  it("passes through a 403 insufficient-role error", async () => {
    stubFetch(
      new Response(JSON.stringify({ message: "insufficient role" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(makeRequest(), paramsFor(IRI));

    expect(response.status).toBe(403);
  });

  it("passes through a 404 version_not_found error", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "version_not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(makeRequest(), paramsFor(IRI));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "version_not_found" });
  });

  it("passes through a 405 already-published error", async () => {
    stubFetch(
      new Response(JSON.stringify({ message: "version is published and immutable" }), {
        status: 405,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(makeRequest(), paramsFor(IRI));

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ message: "version is published and immutable" });
  });

  it("returns 503 when the ontology store is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await POST(makeRequest(), paramsFor(IRI));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });
});
