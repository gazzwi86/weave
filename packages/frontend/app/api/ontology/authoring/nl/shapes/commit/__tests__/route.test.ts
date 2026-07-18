import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ontology/authoring/nl/shapes/commit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

// G3 (remediation-2-api-gaps.md): the New rule drawer's commit step -- proxies
// to governance.py's `POST /api/ontology/authoring/nl/shapes/commit`, which
// re-validates server-side regardless of preview/hand-authored origin.
describe("POST /api/ontology/authoring/nl/shapes/commit", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ shape_iri: "urn:weave:shapes:X", activity_iri: "urn:weave:activity:1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makeRequest({ shape_turtle: "@prefix sh: <...> ." }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty shape_turtle (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest({ shape_turtle: "" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards shape_turtle and ai_generated, defaulting ai_generated to false", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest({ shape_turtle: "@prefix sh: <...> ." }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ shape_iri: "urn:weave:shapes:X", activity_iri: "urn:weave:activity:1" });
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(init?.body as string)).toEqual({
      shape_turtle: "@prefix sh: <...> .",
      ai_generated: false,
    });
  });

  it("proxies a 422 invalid_shape response as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response(JSON.stringify({ detail: { error: "invalid_shape", message: "not a shape" } }), {
        status: 422,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(makeRequest({ shape_turtle: "not turtle" }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "invalid_shape", message: "not a shape" });
  });
});
