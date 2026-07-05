import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(query = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/ontology/resource/urn:weave:process:p1${query}`);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

const RESOURCE_BODY = { iri: "urn:weave:process:p1", kind: "Process", label: "Onboarding" };

// TASK-006 AC-006-15: AI explanations link entity IRIs to this proxy.
// AC-006-02/AC-006-09 use its GET counterpart to confirm a committed entity.
// No `workspace_id` is ever accepted from the client here -- it is server-
// derived on the backend from the caller's session (never client-supplied,
// per the CE-005 workspace-authz lesson).
describe("GET /api/ontology/resource/[...iri]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(RESOURCE_BODY), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ iri: ["urn:weave:process:p1"] }),
    });

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the iri path is empty", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET(makeRequest(), { params: Promise.resolve({ iri: [] }) });

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("re-joins multi-segment IRIs and forwards the bearer token", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ iri: ["urn:weave:process:p1"] }),
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ontology/resource/urn%3Aweave%3Aprocess%3Ap1"),
      expect.objectContaining({ headers: { Authorization: "Bearer token-abc" } })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(RESOURCE_BODY);
  });

  it("forwards an optional ?version= query param", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    await GET(makeRequest("?version=urn:weave:version:v2"), {
      params: Promise.resolve({ iri: ["urn:weave:process:p1"] }),
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("version=urn%3Aweave%3Aversion%3Av2"),
      expect.anything()
    );
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ iri: ["urn:weave:process:p1"] }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
