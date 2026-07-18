import { describe, expect, it, vi } from "vitest";

import { deleteGlossaryTerm, updateGlossaryTerm } from "../glossary-ops";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("updateGlossaryTerm", () => {
  it("posts an update_node op with the lang-tagged label + definition, resolving ok on 200/201", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      expect(body.operations).toEqual([
        {
          op: "update_node",
          iri: "urn:term:invoice",
          properties: {
            "http://www.w3.org/2004/02/skos/core#prefLabel": [{ value: "Invoice", lang: "en" }],
            "http://www.w3.org/2004/02/skos/core#definition": "A billing document.",
          },
        },
      ]);
      return jsonResponse(200, {});
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateGlossaryTerm("urn:term:invoice", {
      prefLabel: "Invoice",
      lang: "en",
      definition: "A billing document.",
    });

    expect(result).toEqual({ type: "ok" });
    vi.unstubAllGlobals();
  });

  it("maps a 422 to field violations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, {
          violations: [{ path: "http://www.w3.org/2004/02/skos/core#prefLabel", message: "Duplicate language tag: en." }],
        })
      )
    );

    const result = await updateGlossaryTerm("urn:term:invoice", { prefLabel: "", lang: "en", definition: "" });

    expect(result).toEqual({
      type: "violations",
      errors: { "http://www.w3.org/2004/02/skos/core#prefLabel": "Duplicate language tag: en." },
    });
    vi.unstubAllGlobals();
  });

  it("never resolves ok on an unrecognised failure status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, {})));

    const result = await updateGlossaryTerm("urn:term:invoice", { prefLabel: "x", lang: "en", definition: "" });

    expect(result).toEqual({ type: "error", status: 500 });
    vi.unstubAllGlobals();
  });
});

describe("deleteGlossaryTerm", () => {
  it("posts a delete_node op, resolving ok on 200", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      expect(body.operations).toEqual([{ op: "delete_node", iri: "urn:term:invoice" }]);
      return jsonResponse(200, {});
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteGlossaryTerm("urn:term:invoice");

    expect(result).toEqual({ type: "ok" });
    vi.unstubAllGlobals();
  });

  it("resolves error on a non-2xx status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, {})));

    const result = await deleteGlossaryTerm("urn:term:invoice");

    expect(result).toEqual({ type: "error", status: 500 });
    vi.unstubAllGlobals();
  });
});
