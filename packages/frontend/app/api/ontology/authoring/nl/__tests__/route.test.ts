import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ontology/authoring/nl", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

const VALID_BODY = { text: "Add a Process called Customer Onboarding", preview: true };

// TASK-006 AC-006-02: the chat panel's NL-parse step proxies to the
// preview-capable `/api/ontology/authoring/nl` (CE-TASK-006 addition to
// TASK-004's route) -- `preview` passes straight through untouched.
describe("POST /api/ontology/authoring/nl", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ operations: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for empty text (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest({ text: "" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards text, known_class_iris, and preview to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    await POST(makeRequest({ ...VALID_BODY, known_class_iris: { "urn:c1": "Process" } }));

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    const sent = JSON.parse(init?.body as string) as { preview: boolean; known_class_iris: object };
    expect(sent.preview).toBe(true);
    expect(sent.known_class_iris).toEqual({ "urn:c1": "Process" });
  });

  it("proxies a 422 nl_parse_failed response as-is (AC-006-06 ambiguity signal)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response(JSON.stringify({ error: "nl_parse_failed", message: "ambiguous" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "nl_parse_failed", message: "ambiguous" });
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
