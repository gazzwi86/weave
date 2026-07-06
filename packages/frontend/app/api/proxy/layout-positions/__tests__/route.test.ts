import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { DELETE, GET, POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const BASE_URL = "http://localhost:3000/api/proxy/layout-positions";
const GRAPH_ID_QUERY = "graph_id=g1";
const ACCESS_TOKEN = "token-abc";
const NO_SESSION_CASE = "returns 401 when there is no session";

function makeGetRequest(query: string): NextRequest {
  return new NextRequest(`${BASE_URL}?${query}`);
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, { method: "POST", body: JSON.stringify(body) });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// TASK-004: proxies GET/POST/DELETE /api/layout/positions with the caller's
// session bearer token attached server-side (Law 13 -- zod-validated params,
// never a cast), mirroring app/api/proxy/sparql/route.ts's exact pattern.
describe("GET /api/proxy/layout-positions", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(jsonResponse({ positions: [] }));
  });

  it(NO_SESSION_CASE, async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET(makeGetRequest(GRAPH_ID_QUERY));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 422 when graph_id is missing (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);

    const response = await GET(makeGetRequest(""));

    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards graph_id to the backend with a bearer token and proxies the response", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);

    const response = await GET(makeGetRequest(GRAPH_ID_QUERY));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/layout/positions?graph_id=g1"),
      expect.objectContaining({ headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ positions: [] });
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET(makeGetRequest(GRAPH_ID_QUERY));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });

  it("returns a distinguishable error when upstream returns a non-JSON body", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    stubFetch(new Response("<html>Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));

    const response = await GET(makeGetRequest(GRAPH_ID_QUERY));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });
});

describe("POST /api/proxy/layout-positions", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(null, { status: 204 }));
  });

  it(NO_SESSION_CASE, async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(
      makePostRequest({ graph_id: "g1", node_iri: "urn:weave:x:1", position_x: 1, position_y: 2 })
    );

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 422 for an invalid body (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);

    const response = await POST(makePostRequest({ graph_id: "g1" }));

    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid body to the backend and proxies a 204", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    const body = { graph_id: "g1", node_iri: "urn:weave:x:1", position_x: 1, position_y: 2 };

    const response = await POST(makePostRequest(body));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/layout/positions"),
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    expect(response.status).toBe(204);
  });
});

describe("DELETE /api/proxy/layout-positions", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(null, { status: 204 }));
  });

  it(NO_SESSION_CASE, async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await DELETE(makeGetRequest(GRAPH_ID_QUERY));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards graph_id and proxies a 204", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);

    const response = await DELETE(makeGetRequest(GRAPH_ID_QUERY));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/layout/positions?graph_id=g1"),
      expect.objectContaining({ method: "DELETE", headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } })
    );
    expect(response.status).toBe(204);
  });
});
