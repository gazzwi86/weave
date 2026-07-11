import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OWL_CLASS,
  SKOS_CONCEPT,
  SKOS_DEFINITION,
  SKOS_PREF_LABEL,
  createGlossaryTerm,
} from "../create-glossary-term";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const INPUT = { prefLabel: "Invoice", lang: "en", definition: "A billing document." };
const MINTED_IRI = "urn:term:invoice";

describe("createGlossaryTerm -- happy path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends an add_node op punning owl:Class with a lang-tagged prefLabel (AC-002-02)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { ref_map: { t1: MINTED_IRI } }));
    vi.stubGlobal("fetch", fetchMock);

    await createGlossaryTerm(INPUT);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      operations: {
        op: string;
        kind: string;
        additional_types: string[];
        properties: Record<string, unknown>;
      }[];
    };
    const op = body.operations[0];
    expect(op?.op).toBe("add_node");
    expect(op?.kind).toBe(SKOS_CONCEPT);
    expect(op?.additional_types).toEqual([OWL_CLASS]);
    expect(op?.properties[SKOS_PREF_LABEL]).toEqual([{ value: "Invoice", lang: "en" }]);
    expect(op?.properties[SKOS_DEFINITION]).toBe("A billing document.");
  });

  it("resolves ok with the minted iri on 201", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, { ref_map: { t1: MINTED_IRI } })));

    const result = await createGlossaryTerm(INPUT);

    expect(result).toEqual({ type: "ok", iri: MINTED_IRI });
  });
});

// Split from the block above to stay under the Law E per-function line
// budget -- covers the 422/error branches.
describe("createGlossaryTerm -- violations and errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a 422 uniqueLang violation to the prefLabel field, naming the language (AC-002-04)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, {
          violations: [{ path: SKOS_PREF_LABEL, message: "Values do not have unique language tags (duplicate language tag: en)" }],
        })
      )
    );

    const result = await createGlossaryTerm(INPUT);

    expect(result).toEqual({
      type: "violations",
      errors: { [SKOS_PREF_LABEL]: "Values do not have unique language tags (duplicate language tag: en)" },
    });
  });

  it("falls back to the prefLabel field for a violation with no path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(422, { violations: [{ path: null, message: "invalid term" }] }))
    );

    const result = await createGlossaryTerm(INPUT);

    expect(result).toEqual({ type: "violations", errors: { [SKOS_PREF_LABEL]: "invalid term" } });
  });

  it("resolves to an error result on 201 with a ref_map missing t1, never returns iri: \"\"", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, { ref_map: {} })));

    const result = await createGlossaryTerm(INPUT);

    expect(result).toEqual({ type: "error", status: 201 });
  });

  it("resolves to an error result on a non-ok, non-422 response, never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(502, { error: "upstream_unavailable" })));

    const result = await createGlossaryTerm(INPUT);

    expect(result).toEqual({ type: "error", status: 502 });
  });

  it("resolves to an error result on a network failure, never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const result = await createGlossaryTerm(INPUT);

    expect(result).toEqual({ type: "error", status: 0 });
  });
});
