import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

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

describe("GET /api/dashboard/example-prompts", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards to the backend and passes the GA-filtered catalogue through", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch({ prompts: ["show entities by kind"], hide_after: 3 }, 200);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ prompts: ["show entities by kind"], hide_after: 3 });
  });
});
