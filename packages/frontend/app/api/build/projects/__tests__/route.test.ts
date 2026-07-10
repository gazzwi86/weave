import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

const CARD = {
  project_iri: "urn:weave:project:p-1",
  name: "Ledger Sync",
  created_at: "2026-07-01T00:00:00Z",
  lifecycle_phase: "Speccing",
  owner_iri: null,
};

function stubFetch(body: unknown, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        })
    )
  );
}

function getRequest(search = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/build/projects${search}`);
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/build/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/build/projects", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("GET returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({ items: [], next_cursor: null }, 200);
    const response = await GET(getRequest());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET forwards filters and returns the grid page", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ items: [CARD], next_cursor: "cursor-2" }, 200);
    const response = await GET(getRequest("?lifecycle_phase=Speccing&search=ledger&limit=25"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/projects\?.*lifecycle_phase=Speccing.*search=ledger.*limit=25|\/api\/projects\?.*search=ledger.*lifecycle_phase=Speccing.*limit=25/
      ),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [CARD], next_cursor: "cursor-2" });
  });

  it("POST returns 400 on empty name (Law 13, never reaches backend)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({}, 201);
    const response = await POST(postRequest({ name: "" }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POST creates a project and returns 201", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    const created = {
      project_iri: "urn:weave:project:p-2",
      pinned_graph_version_iri: "urn:weave:graph:v-1",
      created_at: "2026-07-10T00:00:00Z",
      lifecycle_phase: "Speccing",
    };
    stubFetch(created, 201);
    const response = await POST(postRequest({ name: "Ledger Sync", description: "desc" }));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Ledger Sync", description: "desc" }),
      })
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(created);
  });

  it("POST passes a 409 project_exists response through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "project_exists", existing_iri: "urn:weave:project:p-1" }, 409);
    const response = await POST(postRequest({ name: "Ledger Sync" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "project_exists",
      existing_iri: "urn:weave:project:p-1",
    });
  });
});
