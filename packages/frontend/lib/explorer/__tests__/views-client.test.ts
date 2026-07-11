import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteView, listViews, saveView, shareView } from "../views-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("saveView", () => {
  it("returns created on 201", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ view_id: "v1" }, 201)));
    const result = await saveView({ name: "n", overwrite: false, definition: {} as never, positions: [] });
    expect(result).toEqual({ status: "created", view_id: "v1" });
  });

  it("returns collision on 409 -- AC-1 overwrite/rename prompt driver", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "name_collision", existing_view_id: "v9" }, 409)));
    const result = await saveView({ name: "n", overwrite: false, definition: {} as never, positions: [] });
    expect(result).toEqual({ status: "collision", existing_view_id: "v9" });
  });
});

describe("listViews", () => {
  it("degrades to an empty list on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    expect(await listViews()).toEqual([]);
  });
});

describe("deleteView", () => {
  it("returns false on a 403 (not creator/admin)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "forbidden" }, 403)));
    expect(await deleteView("v1")).toBe(false);
  });
});

describe("shareView", () => {
  it("returns notified/excluded counts, never recipient identities", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ notified: 3, excluded: 1 })));
    expect(await shareView("v1", ["a@x.com"])).toEqual({ notified: 3, excluded: 1 });
  });
});
