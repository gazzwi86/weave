import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { PUT } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/onboarding/tours/ce-overview/progress", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

const params = Promise.resolve({ tourId: "ce-overview" });
const savedBody = { saved: true };

describe("PUT /api/onboarding/tours/[tourId]/progress (AC-007-02)", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(savedBody), { status: 200, headers: { "content-type": "application/json" } }),
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await PUT(makePutRequest({ last_completed_step: 1 }), { params });

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PUT(makePutRequest({ last_completed_step: -1 }), { params });

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid progress write to the backend with the tour id and bearer token", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PUT(
      makePutRequest({ last_completed_step: 1, completed: false, skipped: false }),
      { params },
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/tours/ce-overview/progress"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer token-abc",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ last_completed_step: 1, completed: false, skipped: false }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(savedBody);
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const response = await PUT(makePutRequest({ last_completed_step: 1 }), { params });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
