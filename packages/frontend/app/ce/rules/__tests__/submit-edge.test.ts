import { describe, expect, it, vi } from "vitest";

import { submitAddEdge } from "../submit-edge";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const GOVERNED_BY = "https://weave.io/ontology/governedBy";

describe("submitAddEdge", () => {
  it("dispatches an add_edge op straight to CE-WRITE-1 and resolves ok on 201", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, { applied_count: 1, version_iri: "urn:v1" })));

    const outcome = await submitAddEdge("urn:weave:instances:process-1", GOVERNED_BY, "urn:weave:instances:policy-1");

    expect(fetch).toHaveBeenCalledWith(
      "/api/operations/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              op: "add_edge",
              subject_ref: "urn:weave:instances:process-1",
              predicate: GOVERNED_BY,
              object_ref: "urn:weave:instances:policy-1",
            },
          ],
        }),
      })
    );
    expect(outcome).toEqual({ ok: true, errorMessage: null });
    vi.unstubAllGlobals();
  });

  it("surfaces a 422 violation message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, { violations: [{ path: null, message: "Cannot link to a retired entity." }] })
      )
    );

    const outcome = await submitAddEdge("urn:weave:instances:process-1", GOVERNED_BY, "urn:weave:instances:policy-1");

    expect(outcome).toEqual({ ok: false, errorMessage: "Cannot link to a retired entity." });
    vi.unstubAllGlobals();
  });

  it("never throws on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const outcome = await submitAddEdge("urn:weave:instances:process-1", GOVERNED_BY, "urn:weave:instances:policy-1");

    expect(outcome.ok).toBe(false);
    expect(outcome.errorMessage).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
