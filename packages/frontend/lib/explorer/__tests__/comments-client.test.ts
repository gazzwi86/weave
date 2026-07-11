import { afterEach, describe, expect, it, vi } from "vitest";

import { createComment, listComments } from "../comments-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

// AC-6: "should render comments for node and view targets from service"
describe("listComments", () => {
  it("fetches comments for a node target", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ comment_id: "c1", target_kind: "node", target_ref: "iri:n1", author: "iri:u1", body: "hi", created_at: "2026-01-01" }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const comments = await listComments("node", "iri:n1");

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("target_kind=node"), expect.anything());
    expect(comments).toHaveLength(1);
  });

  it("degrades to an empty list on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    expect(await listComments("view", "v1")).toEqual([]);
  });
});

describe("createComment", () => {
  it("returns the created comment id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ comment_id: "c1" }, 201)));
    expect(await createComment("node", "iri:n1", "hi")).toBe("c1");
  });

  it("returns null on a rejected (empty-body) submission", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "empty_body" }, 400)));
    expect(await createComment("node", "iri:n1", "")).toBeNull();
  });
});
