import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "token-abc";

const GAP_BODY = {
  rows: [{ entity_iri: "https://weave.example/entity/onboard-customer", missing_link: "https://weave.example/ontology/bpmo#performedBy" }],
  column_names: ["entity_iri", "missing_link"],
};

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function mockAuthedSession(accessToken: string | null = TOKEN): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

// TASK-027: proxies CE-READ-1's `coverage_gap_process` named pattern
// (`GET /api/sparql?pattern=coverage_gap_process`) as-is -- GE never
// composes this SPARQL itself (design decision: CE owns the rule).
describe("GET /api/proxy/sparql/coverage-gap", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    mockAuthedSession(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("forwards the bearer token and the pattern param, returning rows as-is", async () => {
    mockAuthedSession();
    stubFetch(new Response(JSON.stringify(GAP_BODY), { status: 200, headers: { "content-type": "application/json" } }));

    const response = await GET();

    const [calledUrl, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/sparql?pattern=coverage_gap_process");
    expect(options.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(GAP_BODY);
  });

  it("passes through the zero-row message body (AC-2)", async () => {
    mockAuthedSession();
    stubFetch(
      new Response(JSON.stringify({ rows: [], column_names: ["entity_iri", "missing_link"], message: "No coverage gaps found" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET();

    expect(await response.json()).toEqual({
      rows: [],
      column_names: ["entity_iri", "missing_link"],
      message: "No coverage gaps found",
    });
  });

  it("returns 503 when the store is unreachable", async () => {
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
