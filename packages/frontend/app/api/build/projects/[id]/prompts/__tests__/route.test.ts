import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "editor" })
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
  return new NextRequest("http://localhost:3000/api/build/projects/p-1/prompts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/build/projects/[id]/prompts", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({ run_id: "r-1", prompt_id: "pr-1" }, 202);

    const response = await POST(postRequest({ prompt_text: "fix this inaccuracy" }), params());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 on empty prompt_text (Law 13, no upstream call)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ run_id: "r-1", prompt_id: "pr-1" }, 202);

    const response = await POST(postRequest({ prompt_text: "" }), params());

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards valid prompt to backend and returns 202 handle (AC-1)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ run_id: "r-1", prompt_id: "pr-1" }, 202);

    const response = await POST(postRequest({ prompt_text: "fix this inaccuracy" }), params("p-1"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/prompts"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ run_id: "r-1", prompt_id: "pr-1" });
  });

  it("passes a 403 (reader) through as-is with audit already recorded server-side (AC-2)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "forbidden", action: "prompt" }, 403);

    const response = await POST(postRequest({ prompt_text: "fix this inaccuracy" }), params());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", action: "prompt" });
  });

  it("passes a 422 (oversized/empty after trim) through as-is (AC-6)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "validation_error", field: "prompt_text" }, 422);

    const response = await POST(postRequest({ prompt_text: "   " }), params());

    expect(response.status).toBe(422);
  });
});
