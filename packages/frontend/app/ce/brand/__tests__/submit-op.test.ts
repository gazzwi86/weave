import { describe, expect, it, vi } from "vitest";

import { submitAddNode, submitDeleteNode, submitUpdateNode } from "../submit-op";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const OP = {
  op: "add_node" as const,
  ref: "form1",
  kind: "https://weave.io/ontology/BrandStandard",
  label: "acme.tone",
  properties: { "https://weave.io/ontology/contentType": "acme.tone" },
};

describe("submitAddNode", () => {
  it("dispatches the op to CE-WRITE-1 and resolves the minted IRI + version on 201", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(201, {
          activity_iri: "urn:a1",
          applied_count: 1,
          version_iri: "urn:v1",
          ref_map: { form1: "urn:weave:instances:bs-1" },
        })
      )
    );

    const outcome = await submitAddNode(OP, "contentType");

    expect(fetch).toHaveBeenCalledWith(
      "/api/operations/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ operations: [OP] }),
      })
    );
    expect(outcome).toEqual({ iri: "urn:weave:instances:bs-1", versionIri: "urn:v1", errors: {} });
    vi.unstubAllGlobals();
  });

  it("maps a 422's violations back onto field keys by predicate path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, {
          violations: [
            {
              focus_node: "_:b1",
              path: "https://weave.io/ontology/contentType",
              severity: "Violation",
              message: "Every BrandStandard must have exactly one string contentType.",
            },
          ],
        })
      )
    );

    const outcome = await submitAddNode(OP, "contentType");

    expect(outcome.iri).toBeNull();
    expect(outcome.errors["https://weave.io/ontology/contentType"]).toBe(
      "Every BrandStandard must have exactly one string contentType."
    );
    vi.unstubAllGlobals();
  });

  it("falls back to the given field for a pathless (whole-node) violation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, {
          violations: [
            { focus_node: "_:b1", path: null, severity: "Violation", message: "must have contentBody or sourceUri" },
          ],
        })
      )
    );

    const outcome = await submitAddNode(OP, "contentType");

    expect(outcome.errors.contentType).toBe("must have contentBody or sourceUri");
    vi.unstubAllGlobals();
  });
});

describe("submitUpdateNode", () => {
  it("dispatches an update_node op and resolves the version on 201", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(201, { activity_iri: "urn:a1", applied_count: 1, version_iri: "urn:v2" }))
    );

    const outcome = await submitUpdateNode(
      "urn:weave:instances:bs-1",
      { "https://weave.io/ontology/contentType": "acme.tone.v2" },
      "contentType"
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/operations/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          operations: [
            {
              op: "update_node",
              iri: "urn:weave:instances:bs-1",
              properties: { "https://weave.io/ontology/contentType": "acme.tone.v2" },
            },
          ],
        }),
      })
    );
    expect(outcome).toEqual({ iri: "urn:weave:instances:bs-1", versionIri: "urn:v2", errors: {} });
    vi.unstubAllGlobals();
  });

  it("maps a 422's violations back onto field keys, same as submitAddNode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, {
          violations: [{ focus_node: "_:b1", path: "https://weave.io/ontology/contentType", message: "bad value" }],
        })
      )
    );

    const outcome = await submitUpdateNode("urn:weave:instances:bs-1", {}, "contentType");

    expect(outcome.iri).toBeNull();
    expect(outcome.errors["https://weave.io/ontology/contentType"]).toBe("bad value");
    vi.unstubAllGlobals();
  });
});

describe("submitDeleteNode", () => {
  it("dispatches a delete_node op and resolves ok on 201", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(201, { activity_iri: "urn:a1", applied_count: 1, version_iri: "urn:v3" }))
    );

    const outcome = await submitDeleteNode("urn:weave:instances:bs-1");

    expect(fetch).toHaveBeenCalledWith(
      "/api/operations/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ operations: [{ op: "delete_node", iri: "urn:weave:instances:bs-1" }] }),
      })
    );
    expect(outcome).toEqual({ ok: true, errorMessage: null });
    vi.unstubAllGlobals();
  });

  it("resolves not-ok with the violation message on a 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(422, { violations: [{ focus_node: null, path: null, message: "in use" }] }))
    );

    const outcome = await submitDeleteNode("urn:weave:instances:bs-1");

    expect(outcome).toEqual({ ok: false, errorMessage: "in use" });
    vi.unstubAllGlobals();
  });

  it("resolves a generic not-ok message on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const outcome = await submitDeleteNode("urn:weave:instances:bs-1");

    expect(outcome).toEqual({ ok: false, errorMessage: "Could not delete. Please try again." });
    vi.unstubAllGlobals();
  });
});
