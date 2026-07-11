import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { PATCH } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "test-token";

const WIDGET = {
  id: "w-1",
  scope: "user",
  spec: { component_type: "table", title: "x", data_source_contracts: [], bindings: {}, column_span: 3 },
  position: 0,
  last_result: null,
  fetched_at: null,
  status: "fresh",
  pending_fields: [],
  suggested: false,
};

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

function params(id = "w-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/dashboard/widgets/w-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/dashboard/widgets/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(WIDGET, 200);

    const response = await PATCH(patchRequest({ spec: { component_type: "table" } }), params());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for a component_type outside the closed catalogue (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(WIDGET, 200);

    const response = await PATCH(
      patchRequest({ spec: { component_type: "not_a_real_component" } }),
      params()
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid component_type patch to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(WIDGET, 200);

    const response = await PATCH(patchRequest({ spec: { component_type: "table" } }), params("w-1"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/widgets/w-1"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        body: JSON.stringify({ spec: { component_type: "table" } }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(WIDGET);
  });

  it("passes a 404 (not found / not owner) through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ detail: "not found" }, 404);

    const response = await PATCH(patchRequest({ spec: { component_type: "table" } }), params());

    expect(response.status).toBe(404);
  });
});
