import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { DELETE } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(shapeIri: string | null): NextRequest {
  const url = new URL("http://localhost:3000/api/ontology/authoring/shapes");
  if (shapeIri !== null) url.searchParams.set("shape_iri", shapeIri);
  return new NextRequest(url, { method: "DELETE" });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

// G3 (remediation-2-api-gaps.md): the retire flow -- proxies to
// governance.py's `DELETE /api/ontology/authoring/shapes?shape_iri=...`.
describe("DELETE /api/ontology/authoring/shapes", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(null, { status: 204 }));
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await DELETE(makeRequest("urn:weave:shapes:X"));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when shape_iri is missing (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await DELETE(makeRequest(null));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards shape_iri and returns 204 on success", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await DELETE(makeRequest("urn:weave:shapes:X"));

    expect(response.status).toBe(204);
    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain(`shape_iri=${encodeURIComponent("urn:weave:shapes:X")}`);
  });

  it("proxies a 403 framework_shape_immutable response as-is (retire gate)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response(JSON.stringify({ detail: { error: "framework_shape_immutable" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await DELETE(makeRequest("urn:weave:shapes:Framework"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "framework_shape_immutable" });
  });

  it("proxies a 404 shape_not_found response as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response(JSON.stringify({ detail: { error: "shape_not_found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await DELETE(makeRequest("urn:weave:shapes:Missing"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "shape_not_found" });
  });
});
