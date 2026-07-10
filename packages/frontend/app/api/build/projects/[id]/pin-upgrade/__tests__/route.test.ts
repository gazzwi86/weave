import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

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

function params(id = "p-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/build/projects/p-1/pin-upgrade", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/build/projects/[id]/pin-upgrade", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("POST returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({ pinned_graph_version_iri: "urn:weave:version:v2" }, 200);
    const response = await POST(
      postRequest({ confirm_version_iri: "urn:weave:version:v2" }),
      params()
    );
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POST returns 400 on an empty body (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ pinned_graph_version_iri: "urn:weave:version:v2" }, 200);
    const response = await POST(postRequest({}), params());
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POST forwards confirm_version_iri to the backend upgrade route", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ pinned_graph_version_iri: "urn:weave:version:v2" }, 200);
    const response = await POST(
      postRequest({ confirm_version_iri: "urn:weave:version:v2" }),
      params("p-1")
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/pin-upgrade"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirm_version_iri: "urn:weave:version:v2" }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pinned_graph_version_iri: "urn:weave:version:v2" });
  });

  it("POST passes AC-3's 409 pin_moved conflict through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "pin_moved", latest_version_iri: "urn:weave:version:v3" }, 409);
    const response = await POST(
      postRequest({ confirm_version_iri: "urn:weave:version:v2" }),
      params()
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "pin_moved",
      latest_version_iri: "urn:weave:version:v3",
    });
  });

  it("POST passes a 403 forbidden response through as-is (editor denied)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "forbidden", action: "settings" }, 403);
    const response = await POST(
      postRequest({ confirm_version_iri: "urn:weave:version:v2" }),
      params()
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", action: "settings" });
  });
});
