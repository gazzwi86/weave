import { describe, expect, it, vi } from "vitest";

import { submitCommitShape, submitPreviewShape, submitRetireShape } from "../submit-shape";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("submitPreviewShape", () => {
  it("returns the candidate shape_turtle on 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { shape_turtle: "weave:FooShape a sh:NodeShape ." })));

    const outcome = await submitPreviewShape("Every Foo must have a bar.");

    expect(fetch).toHaveBeenCalledWith(
      "/api/ontology/authoring/nl/shapes/preview",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ text: "Every Foo must have a bar." }) })
    );
    expect(outcome).toEqual({ shapeTurtle: "weave:FooShape a sh:NodeShape .", errorMessage: null });
    vi.unstubAllGlobals();
  });

  it("surfaces the backend message on a 422 shape_generation_failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(422, { error: "shape_generation_failed", message: "Could not parse that." }))
    );

    const outcome = await submitPreviewShape("gibberish");

    expect(outcome).toEqual({ shapeTurtle: null, errorMessage: "Could not parse that." });
    vi.unstubAllGlobals();
  });

  it("falls back to a generic message on a 503 with no message field", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error: "model_provider_unavailable" })));

    const outcome = await submitPreviewShape("Every Foo must have a bar.");

    expect(outcome.shapeTurtle).toBeNull();
    expect(outcome.errorMessage).toBe("model_provider_unavailable");
    vi.unstubAllGlobals();
  });
});

describe("submitCommitShape", () => {
  it("dispatches shape_turtle + ai_generated and resolves the minted shape_iri on 201", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(201, { shape_iri: "urn:weave:shapes:FooShape", activity_iri: "urn:a1" }))
    );

    const outcome = await submitCommitShape("weave:FooShape a sh:NodeShape .", true);

    expect(fetch).toHaveBeenCalledWith(
      "/api/ontology/authoring/nl/shapes/commit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ shape_turtle: "weave:FooShape a sh:NodeShape .", ai_generated: true }),
      })
    );
    expect(outcome).toEqual({ shapeIri: "urn:weave:shapes:FooShape", errorMessage: null });
    vi.unstubAllGlobals();
  });

  it("surfaces a 422 invalid_shape message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(422, { error: "invalid_shape", message: "Not valid SHACL." }))
    );

    const outcome = await submitCommitShape("not shacl", false);

    expect(outcome).toEqual({ shapeIri: null, errorMessage: "Not valid SHACL." });
    vi.unstubAllGlobals();
  });
});

describe("submitRetireShape", () => {
  it("resolves ok on a 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    const outcome = await submitRetireShape("urn:weave:shapes:FooShape");

    expect(fetch).toHaveBeenCalledWith(
      "/api/ontology/authoring/shapes?shape_iri=urn%3Aweave%3Ashapes%3AFooShape",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(outcome).toEqual({ ok: true, errorMessage: null });
    vi.unstubAllGlobals();
  });

  it("falls back to the error code when a 403 carries no message field", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(403, { error: "framework_shape_immutable" })));

    const outcome = await submitRetireShape("urn:weave:shapes:ProcessOwnerShape");

    expect(outcome).toEqual({ ok: false, errorMessage: "framework_shape_immutable" });
    vi.unstubAllGlobals();
  });
});
