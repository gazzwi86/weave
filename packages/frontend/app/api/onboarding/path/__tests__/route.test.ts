import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, PUT } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/onboarding/path", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

const resolvedBody = {
  role_path: "business",
  path_variant: "default",
  path_chosen_manually: false,
  needs_choice: false,
};

describe("GET /api/onboarding/path", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(resolvedBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the bearer token to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/path"),
      expect.objectContaining({ headers: { Authorization: "Bearer token-abc" } })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(resolvedBody);
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});

describe("PUT /api/onboarding/path", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ ...resolvedBody, path_chosen_manually: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await PUT(makePutRequest({ role_path: "technical" }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid role_path (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PUT(makePutRequest({ role_path: "not-a-path" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid choice to the backend with a bearer token", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PUT(makePutRequest({ role_path: "technical" }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/path"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer token-abc",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ role_path: "technical" }),
      })
    );
    expect(response.status).toBe(200);
  });
});
