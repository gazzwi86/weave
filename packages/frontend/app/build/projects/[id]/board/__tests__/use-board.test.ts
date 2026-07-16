import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBoard } from "../use-board";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const BOARD = { project_iri: "urn:weave:project:acme-corp:hv", lanes: [], cards: [] };
const TREE = { project_iri: "urn:weave:project:acme-corp:hv", nodes: [] };

describe("useBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // BUG-06 encoding coverage now lives in normalize-urn.test.ts (the
  // helper both hooks and this one share); this suite keeps one
  // end-to-end check that the hook still wires it in correctly.
  it("single-encodes an already percent-encoded project IRI (client-nav case)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(BOARD));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useBoard("urn%3Aweave%3Aproject%3Aacme-corp%3Ahv"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/urn%3Aweave%3Aproject%3Aacme-corp%3Ahv/board",
      expect.anything()
    );
  });

  it("loads board + task-tree on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(BOARD))
      .mockResolvedValueOnce(jsonResponse(TREE));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useBoard("urn:weave:project:acme-corp:hv"));

    await waitFor(() => expect(result.current.board).toEqual(BOARD));
    expect(result.current.tree).toEqual(TREE);
    expect(result.current.loadError).toBe(false);
  });

  it("sets loadError on a failed fetch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "not_found" }, 404)));

    const { result } = renderHook(() => useBoard("urn:weave:project:acme-corp:hv"));

    await waitFor(() => expect(result.current.loadError).toBe(true));
  });
});
