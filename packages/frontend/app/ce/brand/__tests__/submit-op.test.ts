import { describe, expect, it, vi } from "vitest";

import { submitAddNode } from "../submit-op";

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
