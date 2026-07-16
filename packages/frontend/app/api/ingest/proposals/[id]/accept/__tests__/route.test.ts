import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

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

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/ingest/proposals/p1/accept", { method: "POST" });
}

describe("POST /api/ingest/proposals/[id]/accept", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch({ activity_iri: "urn:a1", version_iri: "urn:v1" }, 200);
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "p1" }) });

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards accept to the backend and returns 200 on success (AC-002-05)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "p1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ activity_iri: "urn:a1", version_iri: "urn:v1" });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/ingest/proposals/p1/accept");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-abc" });
  });

  it("passes a 422 SHACL-violation response straight through (AC-002-05)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch({ violations: [{ focus_node: "n1", path: null, severity: "Violation", message: "owner required" }] }, 422);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "p1" }) });

    expect(response.status).toBe(422);
    const body = (await response.json()) as { violations: { message: string }[] };
    expect(body.violations.map((v) => v.message)).toEqual(["owner required"]);
  });
});
