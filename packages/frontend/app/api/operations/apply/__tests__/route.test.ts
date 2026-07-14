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
});

// Split from the block above to stay under the Law E per-function line
// budget -- both blocks share the same auth/fetch stubbing setup.
describe("POST /api/operations/apply -- proxying", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ activity_iri: "urn:a", applied_count: 1, version_iri: "urn:v" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
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
});

// Split from the block above to stay under the Law E per-function line
// budget -- shares the same auth/fetch stubbing setup.
describe("POST /api/operations/apply -- error paths", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ activity_iri: "urn:a", applied_count: 1, version_iri: "urn:v" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
  });

  // CE-002/TASK-002: glossary term create punning an owl:Class needs
  // `additional_types` forwarded on the batch -- a stripped-by-zod field
  // silently breaks GlossaryTermShape's mandatory owl:Class pun.
  it("forwards additional_types on an add_node op (glossary owl:Class pun)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    await POST(
      makeRequest({
        operations: [
          {
            op: "add_node",
            ref: "t1",
            kind: "http://www.w3.org/2004/02/skos/core#Concept",
            label: "Invoice",
            additional_types: ["http://www.w3.org/2002/07/owl#Class"],
          },
        ],
      })
    );

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    const sent = JSON.parse(init?.body as string) as {
      operations: { additional_types?: string[] }[];
    };
    expect(sent.operations[0]?.additional_types).toEqual(["http://www.w3.org/2002/07/owl#Class"]);
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
