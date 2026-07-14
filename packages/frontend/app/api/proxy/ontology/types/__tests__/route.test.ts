import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "token-abc";

const TYPES_BODY = {
  kinds: [{ iri: "https://weave.io/ontology/Process", label: "Process", properties: [] }],
  relationships: [{ path: "https://weave.io/ontology/dependsOn", name: "dependsOn", is_relationship: true }],
};

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function mockAuthedSession(accessToken: string | null = TOKEN): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

// TASK-028 AC-2: this route serves the FULL CE-READ-1 types response
// (kinds + relationships), unlike /api/proxy/node-kinds which projects
// only a colour palette and drops relationships entirely -- the drift
// guard needs the relationship list this route preserves.
describe("GET /api/proxy/ontology/types", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    mockAuthedSession(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("forwards the bearer token and returns kinds + relationships as-is", async () => {
    mockAuthedSession();
    stubFetch(new Response(JSON.stringify(TYPES_BODY), { status: 200, headers: { "content-type": "application/json" } }));

    const response = await GET();

    const [calledUrl, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/ontology/types");
    expect(options.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(TYPES_BODY);
  });

  it("returns 503 when the ontology store is unreachable", async () => {
    mockAuthedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });
});
