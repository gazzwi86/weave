import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/operations/apply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

const VALID_BODY = {
  operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "Customer Onboarding" }],
};

// TASK-006 AC-006-03: chat/guided-form confirm dispatches straight to
// CE-WRITE-1 through this proxy. `actor` is never accepted from the client
// body -- it is always derived server-side from the caller's session, the
// same "never trust a client-supplied identity field" rule CE-005 applied
// to workspace_id.
describe("POST /api/operations/apply", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ activity_iri: "urn:a", applied_count: 1, version_iri: "urn:v" }), {
        status: 201,
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

  it("returns 400 for an empty operations array (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest({ operations: [] }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown op discriminator", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest({ operations: [{ op: "not_a_real_op" }] }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("derives actor from the session, never from the request body", async () => {
    vi.mocked(auth).mockResolvedValue({
      accessToken: "token-abc",
      user: { email: "modeller@example.com" },
    } as never);

    await POST(makeRequest({ ...VALID_BODY, actor: "urn:weave:principal:user:spoofed" }));

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    const sent = JSON.parse(init?.body as string) as { actor: string };
    expect(sent.actor).toBe("modeller@example.com");
  });

  it("forwards the operations batch with a bearer token and proxies a 201", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest(VALID_BODY));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/operations/apply"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
      })
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ activity_iri: "urn:a", applied_count: 1, version_iri: "urn:v" });
  });

  it("proxies a 422 SHACL violation response as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response(JSON.stringify({ violations: [{ focus_node: "urn:a", path: null, severity: "Violation", message: "msg" }] }), {
        status: 422,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      violations: [{ focus_node: "urn:a", path: null, severity: "Violation", message: "msg" }],
    });
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
