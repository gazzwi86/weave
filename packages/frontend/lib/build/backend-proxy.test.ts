import { beforeEach, describe, expect, it, vi } from "vitest";

import { forwardToBackend } from "./backend-proxy";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("forwardToBackend", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes a 2xx JSON body through untouched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ model_tier: "mid" }, 200)));
    const response = await forwardToBackend("/api/projects/p-1/settings", "tok");
    expect(await response.json()).toEqual({ model_tier: "mid" });
  });

  /** Every route this helper serves raises `HTTPException(detail={...})`,
   * which Starlette always nests under a `detail` key (see
   * `weave_backend/routers/projects.py`'s `projects_validation_error_handler`
   * docstring) -- unwrap it here, once, so every proxied error body is the
   * flat `{"error": ...}` shape the UI (and every route's own tests)
   * already expect, instead of every route re-implementing the unwrap. */
  it("flattens a Starlette-style {detail: {...}} error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { detail: { error: "cap_looser_than_parent", level: "company", parent_cap_usd: 25 } },
          422
        )
      )
    );
    const response = await forwardToBackend("/api/projects/p-1/settings", "tok");
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "cap_looser_than_parent",
      level: "company",
      parent_cap_usd: 25,
    });
  });

  it("leaves a 2xx body with a detail field untouched (not an error envelope)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "not an error" }, 200)));
    const response = await forwardToBackend("/api/projects/p-1/settings", "tok");
    expect(await response.json()).toEqual({ detail: "not an error" });
  });
});
