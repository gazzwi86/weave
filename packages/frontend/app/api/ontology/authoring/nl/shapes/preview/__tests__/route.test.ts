import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ontology/authoring/nl/shapes/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

// G3/G14 (remediation-2-api-gaps.md): the New rule drawer's preview step --
// proxies to governance.py's `POST /api/ontology/authoring/nl/shapes/preview`.
describe("POST /api/ontology/authoring/nl/shapes/preview", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ shape_turtle: "@prefix sh: <...> ." }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makeRequest({ text: "Processes must have an owner" }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for empty text (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest({ text: "" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards text to the backend and returns the candidate shape", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest({ text: "Processes must have an owner" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ shape_turtle: "@prefix sh: <...> ." });
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(init?.body as string)).toEqual({ text: "Processes must have an owner" });
  });

  it("surfaces a 503 model_provider_unavailable as graceful degradation, not a raw failure", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response(JSON.stringify({ detail: { error: "model_provider_unavailable" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(makeRequest({ text: "Processes must have an owner" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "model_provider_unavailable" });
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await POST(makeRequest({ text: "Processes must have an owner" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
