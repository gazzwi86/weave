import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const PROPOSAL = {
  id: "p1",
  ops: [{ op: "add_node", ref: "n1", kind: "Process", label: "Onboarding" }],
  confidence: 0.9,
  matched_iri: null,
  reason: "found in section 2",
  status: "proposed",
  source_span: "Intro > Onboarding",
  low_confidence: false,
};

function stubFetch(body: unknown, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    )
  );
}

describe("GET /api/ingest/jobs/[id]/proposals", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch({ proposals: [PROPOSAL], has_more: false }, 200);
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/ingest/jobs/job-1/proposals"),
      { params: Promise.resolve({ id: "job-1" }) }
    );

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards to the backend proposals-list endpoint (AC-002-03/-04)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/ingest/jobs/job-1/proposals"),
      { params: Promise.resolve({ id: "job-1" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ proposals: [PROPOSAL], has_more: false });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/ingest/jobs/job-1/proposals");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-abc" });
  });
});
