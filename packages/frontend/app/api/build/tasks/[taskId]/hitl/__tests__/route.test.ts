import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(JSON.stringify({ tenant_id: "tenant-1" })).toString("base64url")}.sig`;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/build/tasks/task-8/hitl", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function stubFetch(body: unknown, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }))
  );
}

const PARAMS = { params: Promise.resolve({ taskId: "task-8" }) };

describe("POST /api/build/tasks/[taskId]/hitl", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({}, 200);

    const response = await POST(makeRequest({ action: "approve" }), PARAMS);

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an unknown action without calling the backend (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({}, 200);

    const response = await POST(makeRequest({ action: "delete" }), PARAMS);

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects action=amend with no amendment text (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({}, 200);

    const response = await POST(makeRequest({ action: "amend" }), PARAMS);

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid approve action to the backend hitl endpoint", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ action: "resumed" }, 200);

    const response = await POST(makeRequest({ action: "approve" }), PARAMS);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tasks/task-8/hitl"),
      expect.objectContaining({ method: "POST" })
    );
    expect(response.status).toBe(200);
  });

  it("passes through the backend's self-approval 403 unchanged", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "self_approval_not_permitted" }, 403);

    const response = await POST(makeRequest({ action: "approve" }), PARAMS);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "self_approval_not_permitted" });
  });
});
