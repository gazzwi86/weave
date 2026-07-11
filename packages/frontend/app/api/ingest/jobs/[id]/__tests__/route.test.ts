import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

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

describe("GET /api/ingest/jobs/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch({ job_id: "job-1", status: "awaiting-review", kind: "doc", artefact_iri: "urn:a1" }, 200);
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/ingest/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards to the backend job-status endpoint with the bearer token", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/ingest/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "awaiting-review" });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/api/ingest/jobs/job-1");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-abc" });
  });

  it("returns 404 straight through when the backend reports job_not_found", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch({ error: "job_not_found" }, 404);

    const response = await GET(new NextRequest("http://localhost:3000/api/ingest/jobs/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });

    expect(response.status).toBe(404);
  });
});
